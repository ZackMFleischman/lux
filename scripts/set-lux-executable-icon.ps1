<#
.SYNOPSIS
Replaces every Windows group-icon resource in a staged executable with a .ico file.

.DESCRIPTION
Uses only Kernel32 resource APIs. The executable is modified in place, so pass a
packaged or copied executable. Direct Electron binaries inside node_modules are
refused to protect the installed runtime used by development.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [Parameter(Mandatory)] [ValidateNotNullOrEmpty()] [string]$Executable,
  [Parameter(Mandatory)] [ValidateNotNullOrEmpty()] [string]$Icon
)

$ErrorActionPreference = 'Stop'
$exePath = (Resolve-Path -LiteralPath $Executable).Path
$iconPath = (Resolve-Path -LiteralPath $Icon).Path
if ([IO.Path]::GetExtension($exePath) -ne '.exe') { throw "Executable must be an .exe file: $exePath" }
if ([IO.Path]::GetExtension($iconPath) -ne '.ico') { throw "Icon must be an .ico file: $iconPath" }
if ($exePath -match '[\\/]node_modules[\\/].*electron[\\/]dist[\\/]electron\.exe$') {
  throw "Refusing to alter Electron's source executable in node_modules. Copy it to a package/staging path first."
}

if (-not ('LuxExecutableIcon.Native' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;

namespace LuxExecutableIcon {
  public sealed class Target {
    public bool IsInteger;
    public ushort Id;
    public string Name;
    public ushort Language;
    public override string ToString() { return IsInteger ? "#" + Id + " (lang " + Language + ")" : Name + " (lang " + Language + ")"; }
  }

  public static class Native {
    const uint LOAD_LIBRARY_AS_DATAFILE = 0x00000002;
    const ushort RT_ICON = 3, RT_GROUP_ICON = 14;
    delegate bool EnumResNameProc(IntPtr module, IntPtr type, IntPtr name, IntPtr parameter);
    delegate bool EnumResLangProc(IntPtr module, IntPtr type, IntPtr name, ushort language, IntPtr parameter);

    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr LoadLibraryEx(string file, IntPtr fileHandle, uint flags);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool FreeLibrary(IntPtr module);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool EnumResourceNames(IntPtr module, IntPtr type, EnumResNameProc callback, IntPtr parameter);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool EnumResourceLanguages(IntPtr module, IntPtr type, IntPtr name, EnumResLangProc callback, IntPtr parameter);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr BeginUpdateResource(string file, bool deleteExisting);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool UpdateResource(IntPtr update, IntPtr type, IntPtr name, ushort language, byte[] data, uint bytes);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool EndUpdateResource(IntPtr update, bool discard);

    static Exception Error(string operation) { return new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), operation + " failed"); }
    static bool IsIntegerResource(IntPtr value) { return (((ulong)value.ToInt64()) >> 16) == 0; }
    static IntPtr ResourceName(Target target, out IntPtr allocated) {
      allocated = IntPtr.Zero;
      if (target.IsInteger) return (IntPtr)target.Id;
      allocated = Marshal.StringToHGlobalUni(target.Name);
      return allocated;
    }
    static IntPtr IntegerResource(ushort id) { return (IntPtr)id; }

    public static Target[] GetGroupIconTargets(string exe) {
      var result = new List<Target>();
      IntPtr module = LoadLibraryEx(exe, IntPtr.Zero, LOAD_LIBRARY_AS_DATAFILE);
      if (module == IntPtr.Zero) throw Error("LoadLibraryEx");
      try {
        EnumResNameProc onName = (h, type, name, parameter) => {
          var key = new Target { IsInteger = IsIntegerResource(name), Id = (ushort)name.ToInt64(), Name = IsIntegerResource(name) ? null : Marshal.PtrToStringUni(name) };
          IntPtr allocated; IntPtr resourceName = ResourceName(key, out allocated);
          try {
            EnumResLangProc onLanguage = (h2, type2, name2, language, parameter2) => { result.Add(new Target { IsInteger = key.IsInteger, Id = key.Id, Name = key.Name, Language = language }); return true; };
            if (!EnumResourceLanguages(module, IntegerResource(RT_GROUP_ICON), resourceName, onLanguage, IntPtr.Zero)) throw Error("EnumResourceLanguages");
          } finally { if (allocated != IntPtr.Zero) Marshal.FreeHGlobal(allocated); }
          return true;
        };
        if (!EnumResourceNames(module, IntegerResource(RT_GROUP_ICON), onName, IntPtr.Zero)) throw Error("EnumResourceNames");
      } finally { FreeLibrary(module); }
      return result.ToArray();
    }

    sealed class IcoImage { public byte Width, Height, Colors, Reserved; public ushort Planes, Bits; public byte[] Data; }
    static IcoImage[] ReadIco(string path) {
      using (var reader = new BinaryReader(File.OpenRead(path))) {
        if (reader.ReadUInt16() != 0 || reader.ReadUInt16() != 1) throw new InvalidDataException("The icon file is not a Windows ICO.");
        ushort count = reader.ReadUInt16(); if (count == 0) throw new InvalidDataException("The icon file has no image entries.");
        var entries = new IcoImage[count]; var offsets = new uint[count]; var lengths = new uint[count];
        for (int i=0; i<count; i++) { entries[i] = new IcoImage { Width=reader.ReadByte(), Height=reader.ReadByte(), Colors=reader.ReadByte(), Reserved=reader.ReadByte(), Planes=reader.ReadUInt16(), Bits=reader.ReadUInt16() }; lengths[i]=reader.ReadUInt32(); offsets[i]=reader.ReadUInt32(); }
        long fileLength = reader.BaseStream.Length;
        for (int i=0; i<count; i++) { if ((ulong)offsets[i] + lengths[i] > (ulong)fileLength) throw new InvalidDataException("An ICO image entry points outside the file."); reader.BaseStream.Position=offsets[i]; entries[i].Data=reader.ReadBytes((int)lengths[i]); }
        return entries;
      }
    }

    public static string[] ReplaceAllGroupIcons(string exe, string ico) {
      var targets = GetGroupIconTargets(exe); if (targets.Length == 0) throw new InvalidOperationException("No RT_GROUP_ICON resources were found in the executable.");
      var images = ReadIco(ico); int required = targets.Length * images.Length; const int firstIconId = 50000;
      if (firstIconId + required > UInt16.MaxValue) throw new InvalidOperationException("Too many group icon resources to allocate replacement icon IDs.");
      IntPtr update = BeginUpdateResource(exe, false); if (update == IntPtr.Zero) throw Error("BeginUpdateResource");
      bool committed = false;
      try {
        int nextIconId = firstIconId;
        foreach (var target in targets) {
          ushort[] ids = new ushort[images.Length];
          for (int i=0; i<images.Length; i++) {
            ids[i] = (ushort)nextIconId++;
            if (!UpdateResource(update, IntegerResource(RT_ICON), IntegerResource(ids[i]), target.Language, images[i].Data, (uint)images[i].Data.Length)) throw Error("UpdateResource RT_ICON");
          }
          using (var stream = new MemoryStream()) using (var writer = new BinaryWriter(stream)) {
            writer.Write((ushort)0); writer.Write((ushort)1); writer.Write((ushort)images.Length);
            for (int i=0; i<images.Length; i++) { var image=images[i]; writer.Write(image.Width); writer.Write(image.Height); writer.Write(image.Colors); writer.Write(image.Reserved); writer.Write(image.Planes); writer.Write(image.Bits); writer.Write((uint)image.Data.Length); writer.Write(ids[i]); }
            writer.Flush(); IntPtr allocated; IntPtr name=ResourceName(target, out allocated);
            try { var group=stream.ToArray(); if (!UpdateResource(update, IntegerResource(RT_GROUP_ICON), name, target.Language, group, (uint)group.Length)) throw Error("UpdateResource RT_GROUP_ICON"); }
            finally { if (allocated != IntPtr.Zero) Marshal.FreeHGlobal(allocated); }
          }
        }
        if (!EndUpdateResource(update, false)) throw Error("EndUpdateResource");
        committed = true;
      } finally { if (!committed) EndUpdateResource(update, true); }
      var labels = new string[targets.Length]; for (int i=0; i<targets.Length; i++) labels[i]=targets[i].ToString(); return labels;
    }
  }
}
'@
}

$targets = [LuxExecutableIcon.Native]::GetGroupIconTargets($exePath)
if ($targets.Count -eq 0) { throw "No group icon resources were found in $exePath" }
Write-Host ("Found group icon resource(s): " + ($targets -join ', '))
if ($PSCmdlet.ShouldProcess($exePath, "replace $($targets.Count) group icon resource(s) using $iconPath")) {
  $updated = [LuxExecutableIcon.Native]::ReplaceAllGroupIcons($exePath, $iconPath)
  Write-Host ("Updated group icon resource(s): " + ($updated -join ', '))
}
