# Context-only diagnostic

Source17f34d6, diagnostics-only native checkpointb79018c. Native build and6CPU CTests passed before execution.

No browser renderer was started. Supervised standalone receiver exited5; cleanupComplete=true, no timeout. Native wglCreateContextAttribsARB failed with raw Win32 value3221688541 (0xC00710DD); activation was never attempted. Host GL4.1 core reports NVIDIA RTX2070/591.44. Host and worker both report pixelFormat9 with matching PFD fields. Both Windows monitor descriptors identify Intel UHD Graphics; that descriptor is explicitly not an OpenGL adapter LUID.

Next single hypothesis: create the share context on the host thread/DC, then activate only on an independent compatible worker DC. This preserves owned worker drawable use. The WGL extension permits binding a created context to another compatible same-device pixel-format DC. No cause of the original system freeze is established.

Reference: https://registry.khronos.org/OpenGL/extensions/ARB/WGL_ARB_create_context.txt
