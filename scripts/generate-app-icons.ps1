# Builds the Android launcher icons from the TradeVistar emblem, one set per flavor, so testers can
# tell the builds apart on a home screen:
#   prod     the plain emblem (android/app/src/main/res)
#   staging  the emblem with a blue "STG" band (android/app/src/staging/res)
#   dev      the emblem with an orange "DEV" band (android/app/src/dev/res)
# Usage: powershell -File scripts/generate-app-icons.ps1 [-Source path\to\icon.png]
param([string]$Source = (Join-Path $PSScriptRoot '..\..\TradeVistar\Seller\public\logo\tradevistar-icon.png'))
Add-Type -AssemblyName System.Drawing
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$src = [System.Drawing.Image]::FromFile((Resolve-Path $Source))

function New-Icon([int]$size, [string]$path, [bool]$round, [string]$label, [string]$bandColor) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear([System.Drawing.Color]::Transparent)
  $white = [System.Drawing.Brushes]::White
  if ($round) { $g.FillEllipse($white, 0, 0, $size - 1, $size - 1) } else { $g.FillRectangle($white, 0, 0, $size, $size) }
  $padding = if ($round) { 0.16 } else { 0.10 }
  $inner = $size * (1 - 2 * $padding)
  $ratio = [Math]::Min($inner / $src.Width, $inner / $src.Height)
  $w = $src.Width * $ratio; $h = $src.Height * $ratio
  $g.DrawImage($src, [float](($size - $w) / 2), [float](($size - $h) / 2), [float]$w, [float]$h)
  if ($label) {
    # A coloured band across the bottom, clipped to the icon's shape.
    $bandHeight = [int]($size * 0.26)
    $clip = New-Object System.Drawing.Drawing2D.GraphicsPath
    if ($round) { $clip.AddEllipse(0, 0, $size - 1, $size - 1) } else { $clip.AddRectangle((New-Object System.Drawing.Rectangle 0, 0, $size, $size)) }
    $g.SetClip($clip)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($bandColor))
    $g.FillRectangle($brush, 0, $size - $bandHeight, $size, $bandHeight)
    $font = New-Object System.Drawing.Font 'Arial', ([float]($bandHeight * 0.55)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = 'Center'; $format.LineAlignment = 'Center'
    $rect = New-Object System.Drawing.RectangleF 0, ($size - $bandHeight), $size, $bandHeight
    $g.DrawString($label, $font, [System.Drawing.Brushes]::White, $rect, $format)
    $g.ResetClip()
  }
  $g.Dispose()
  New-Item -ItemType Directory -Force (Split-Path $path) | Out-Null
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}

$sizes = @{ mdpi = 48; hdpi = 72; xhdpi = 96; xxhdpi = 144; xxxhdpi = 192 }
$flavors = @(
  @{ dir = 'main'; label = ''; color = '' },
  @{ dir = 'staging'; label = 'STG'; color = '#034FA6' },
  @{ dir = 'dev'; label = 'DEV'; color = '#EC5D03' }
)
foreach ($flavor in $flavors) {
  foreach ($k in $sizes.Keys) {
    $dir = Join-Path $root "android\app\src\$($flavor.dir)\res\mipmap-$k"
    New-Icon $sizes[$k] (Join-Path $dir 'ic_launcher.png') $false $flavor.label $flavor.color
    New-Icon $sizes[$k] (Join-Path $dir 'ic_launcher_round.png') $true $flavor.label $flavor.color
  }
}
$src.Dispose()
Write-Host 'Launcher icons written for prod, staging and dev.'
