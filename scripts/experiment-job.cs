using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

// A suspended child is assigned before its first instruction. Descendants inherit
// membership; no PID enumeration or taskkill can target an unrelated process.
public static class ExperimentJob {
  [StructLayout(LayoutKind.Sequential)] struct SI {
    public int cb; public IntPtr reserved, desktop, title; public int x,y,cx,cy,xChars,yChars,fill,flags;
    public short show, reserved2; public IntPtr reserved3, stdin, stdout, stderr;
  }
  [StructLayout(LayoutKind.Sequential)] struct PI { public IntPtr process, thread; public int pid, tid; }
  [StructLayout(LayoutKind.Sequential)] struct Limits {
    public long processTime, jobTime; public uint flags; public UIntPtr min,max;
    public uint active; public UIntPtr affinity; public uint priority,scheduling;
  }
  [StructLayout(LayoutKind.Sequential)] struct Extended {
    public Limits basic; public ulong r,w,o,rb,wb,ob; public UIntPtr pm,jm,peakP,peakJ;
  }
  [StructLayout(LayoutKind.Sequential)] struct Accounting {
    public long user,kernel,periodUser,periodKernel; public uint faults,total,active,terminated;
  }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr a,string n);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr j,int c,ref Extended x,int n);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr j,int c,out Accounting x,int n,IntPtr r);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr j,IntPtr p);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string app,StringBuilder cmd,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref SI si,out PI pi);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetHandleInformation(IntPtr h,uint mask,uint flags);
  [DllImport("kernel32.dll")] static extern uint ResumeThread(IntPtr t);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr p,uint ms);
  [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr p,out uint code);
  [DllImport("kernel32.dll")] static extern bool TerminateJobObject(IntPtr j,uint code);
  [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr p,uint code);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  static void Check(bool ok) { if(!ok) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error()); }
  public static void Run(string exe,string command,string cwd,string dir,int timeout,ulong memoryLimitBytes=0) {
    if(memoryLimitBytes!=0 && (memoryLimitBytes<67108864 || memoryLimitBytes>4294967296)) throw new ArgumentOutOfRangeException("memoryLimitBytes", "Use zero or 64 MiB through 4 GiB");
    IntPtr job=CreateJobObject(IntPtr.Zero,null); Check(job!=IntPtr.Zero);
    PI pi=new PI(); bool assigned=false;
    using(var stdout=new FileStream(Path.Combine(dir,"stdout.log"),FileMode.Create,FileAccess.Write,FileShare.ReadWrite))
    using(var stderr=new FileStream(Path.Combine(dir,"stderr.log"),FileMode.Create,FileAccess.Write,FileShare.ReadWrite)) {
      try {
        var limits=new Extended(); limits.basic.flags=0x2000; // KILL_ON_JOB_CLOSE
        if(memoryLimitBytes!=0) { limits.basic.flags|=0x200; limits.jm=(UIntPtr)memoryLimitBytes; }
        Check(SetInformationJobObject(job,9,ref limits,Marshal.SizeOf(limits)));
        Check(SetHandleInformation(stdout.SafeFileHandle.DangerousGetHandle(),1,1));
        Check(SetHandleInformation(stderr.SafeFileHandle.DangerousGetHandle(),1,1));
        var si=new SI(); si.cb=Marshal.SizeOf(si); si.flags=0x100;
        si.stdout=stdout.SafeFileHandle.DangerousGetHandle(); si.stderr=stderr.SafeFileHandle.DangerousGetHandle();
        Check(CreateProcess(exe,new StringBuilder(command),IntPtr.Zero,IntPtr.Zero,true,0x08000004,IntPtr.Zero,cwd,ref si,out pi));
        Check(AssignProcessToJobObject(job,pi.process)); assigned=true;
        File.WriteAllText(Path.Combine(dir,"child.json"),"{\"pid\":"+pi.pid+",\"startUtc\":\""+DateTime.UtcNow.ToString("o")+"\",\"startTicks\":\""+Stopwatch.GetTimestamp()+"\",\"frequency\":"+Stopwatch.Frequency+"}");
        if(ResumeThread(pi.thread)==0xffffffff) throw new Exception("ResumeThread failed");
        uint waitResult=WaitForSingleObject(pi.process,(uint)timeout);
        if(waitResult!=0 && waitResult!=258) throw new Exception("Process wait failed");
        bool timed=waitResult==258;
        uint code; Check(GetExitCodeProcess(pi.process,out code));
        Check(TerminateJobObject(job,timed?124u:0u));
        var wait=Stopwatch.StartNew(); Accounting a;
        do { Check(QueryInformationJobObject(job,1,out a,Marshal.SizeOf(typeof(Accounting)),IntPtr.Zero)); if(a.active==0) break; Thread.Sleep(20); } while(wait.ElapsedMilliseconds<3000);
        if(a.active!=0) throw new Exception("Job cleanup incomplete; retain lock");
        Check(GetExitCodeProcess(pi.process,out code));
        File.WriteAllText(Path.Combine(dir,"result.json"),"{\"exitCode\":"+code+",\"timeout\":"+(timed?"true":"false")+",\"cleanupComplete\":true,\"endUtc\":\""+DateTime.UtcNow.ToString("o")+"\",\"endTicks\":\""+Stopwatch.GetTimestamp()+"\"}");
      } finally {
        if(pi.process!=IntPtr.Zero && !assigned) TerminateProcess(pi.process,125);
        if(pi.thread!=IntPtr.Zero) CloseHandle(pi.thread);
        if(pi.process!=IntPtr.Zero) CloseHandle(pi.process);
        CloseHandle(job);
      }
    }
  }
}
