[CmdletBinding()]
param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\apps\studio\assets\branding')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function New-RoundedPath([float]$size, [float]$radius) {
  $p = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $radius * 2
  $p.AddArc(0, 0, $d, $d, 180, 90)
  $p.AddArc($size - $d, 0, $d, $d, 270, 90)
  $p.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
  $p.AddArc(0, $size - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function New-IconBitmap([int]$size) {
  $bmp = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $scale = $size / 1024.0
    $path = New-RoundedPath 1024 228
    $matrix = [System.Drawing.Drawing2D.Matrix]::new($scale, 0, 0, $scale, 0, 0)
    $path.Transform($matrix)
    $base = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.PointF]::new(100*$scale,60*$scale), [System.Drawing.PointF]::new(910*$scale,970*$scale), [System.Drawing.Color]::FromArgb(255,32,37,82), [System.Drawing.Color]::FromArgb(255,9,11,33))
    $g.FillPath($base, $path)
    $base.Dispose(); $path.Dispose(); $matrix.Dispose()

    $glow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(26,84,225,255))
    $g.FillEllipse($glow, 185*$scale, 130*$scale, 410*$scale, 356*$scale)
    $glow.Dispose()
    $glow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(24,181,143,255))
    $g.FillEllipse($glow, 443*$scale, 514*$scale, 446*$scale, 320*$scale)
    $glow.Dispose()

    $points = [System.Drawing.PointF[]]@(
      [System.Drawing.PointF]::new(370*$scale,241*$scale), [System.Drawing.PointF]::new(486*$scale,210*$scale),
      [System.Drawing.PointF]::new(486*$scale,621*$scale), [System.Drawing.PointF]::new(730*$scale,621*$scale),
      [System.Drawing.PointF]::new(728*$scale,743*$scale), [System.Drawing.PointF]::new(370*$scale,743*$scale))
    $beam = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.PointF]::new(350*$scale,235*$scale), [System.Drawing.PointF]::new(735*$scale,745*$scale), [System.Drawing.Color]::FromArgb(255,182,247,255), [System.Drawing.Color]::FromArgb(255,182,154,255))
    $blend = [System.Drawing.Drawing2D.ColorBlend]::new(3)
    $blend.Colors = [System.Drawing.Color[]]@([System.Drawing.Color]::FromArgb(255,182,247,255),[System.Drawing.Color]::FromArgb(255,114,232,255),[System.Drawing.Color]::FromArgb(255,182,154,255))
    $blend.Positions = [single[]]@(0,0.48,1)
    $beam.InterpolationColors = $blend
    $g.FillPolygon($beam, $points); $beam.Dispose()
    $borderPath = New-RoundedPath $size (228*$scale)
    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(46,184,200,255), [Math]::Max(1, 1.5*$scale))
    $g.DrawPath($pen, $borderPath); $pen.Dispose(); $borderPath.Dispose()
  } finally { $g.Dispose() }
  return $bmp
}

function Save-Png([System.Drawing.Bitmap]$bitmap, [string]$path) {
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Save-Ico([hashtable]$images, [string]$path) {
  $streams = @(); $entries = @()
  foreach ($size in $images.Keys | Sort-Object) {
    $stream = [System.IO.MemoryStream]::new(); $images[$size].Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    $streams += $stream
    $entries += [pscustomobject]@{ Size = [int]$size; Data = $stream.ToArray() }
  }
  $writer = [System.IO.BinaryWriter]::new([System.IO.File]::Open($path, [System.IO.FileMode]::Create))
  try {
    $writer.Write([UInt16]0); $writer.Write([UInt16]1); $writer.Write([UInt16]$entries.Count)
    $offset = 6 + (16 * $entries.Count)
    foreach ($entry in $entries) {
      $writer.Write([byte]$(if ($entry.Size -ge 256) { 0 } else { $entry.Size }))
      $writer.Write([byte]$(if ($entry.Size -ge 256) { 0 } else { $entry.Size }))
      $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([UInt16]1); $writer.Write([UInt16]32)
      $writer.Write([UInt32]$entry.Data.Length); $writer.Write([UInt32]$offset); $offset += $entry.Data.Length
    }
    foreach ($entry in $entries) { $writer.Write($entry.Data) }
  } finally { $writer.Dispose(); foreach ($stream in $streams) { $stream.Dispose() } }
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$bitmaps = @{}
foreach ($size in 16,24,32,48,64,128,256,512,1024) {
  $bitmaps[$size] = New-IconBitmap $size
  Save-Png $bitmaps[$size] (Join-Path $OutputDirectory ("lux-icon-{0}.png" -f $size))
}
Copy-Item (Join-Path $OutputDirectory 'lux-icon-1024.png') (Join-Path $OutputDirectory 'lux-icon.png') -Force
Copy-Item (Join-Path $OutputDirectory 'lux-icon-32.png') (Join-Path $OutputDirectory 'lux-favicon.png') -Force
Save-Ico @{ 16=$bitmaps[16];24=$bitmaps[24];32=$bitmaps[32];48=$bitmaps[48];64=$bitmaps[64];128=$bitmaps[128];256=$bitmaps[256] } (Join-Path $OutputDirectory 'lux.ico')

$sheet = [System.Drawing.Bitmap]::new(1600, 860, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($sheet)
try {
  $g.Clear([System.Drawing.Color]::FromArgb(255, 11, 14, 33)); $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $font = [System.Drawing.Font]::new('Segoe UI', 25, [System.Drawing.FontStyle]::Regular); $small = [System.Drawing.Font]::new('Segoe UI', 18)
  $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255,242,244,255)); $muted = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255,161,170,205))
  $g.DrawString('Lux brand assets', $font, $white, 64, 48); $g.DrawString('Luminous L beam • dark indigo base', $small, $muted, 64, 88)
  $layout = @(@{S=256;X=64;Y=170},@{S=128;X=400;Y=170},@{S=64;X=608;Y=170},@{S=32;X=752;Y=170},@{S=16;X=864;Y=170})
  foreach ($item in $layout) { $g.DrawImage($bitmaps[$item.S], $item.X, $item.Y, $item.S, $item.S); $g.DrawString("$($item.S) px", $small, $muted, $item.X, $item.Y+$item.S+26) }
  $g.DrawString('Wordmark', $small, $muted, 64, 555)
  $g.DrawImage($bitmaps[128], 64, 600, 128, 128); $wordFont = [System.Drawing.Font]::new('Segoe UI', 72, [System.Drawing.FontStyle]::Bold)
  $g.DrawString('Lux', $wordFont, $white, 218, 619)
  $font.Dispose(); $small.Dispose(); $wordFont.Dispose(); $white.Dispose(); $muted.Dispose()
  Save-Png $sheet (Join-Path $OutputDirectory 'lux-brand-contact-sheet.png')
} finally { $g.Dispose(); $sheet.Dispose(); foreach ($bitmap in $bitmaps.Values) { $bitmap.Dispose() } }

Write-Host "Generated Lux branding assets in $OutputDirectory"
