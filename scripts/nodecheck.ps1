[CmdletBinding()]
param(
  [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
  [string[]]$Paths,

  [switch]$All
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  Write-Error 'Node.js is not available on PATH.'
  exit 1
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$targetFiles = New-Object System.Collections.Generic.List[string]

function Add-ResolvedFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath
  )

  $resolved = Resolve-Path -LiteralPath $InputPath -ErrorAction Stop
  foreach ($item in $resolved) {
    if (Test-Path -LiteralPath $item.Path -PathType Container) {
      Write-Warning "Skipping directory: $($item.Path)"
      continue
    }

    $extension = [System.IO.Path]::GetExtension($item.Path)
    if ($extension -notin '.js', '.mjs', '.cjs') {
      Write-Warning "Skipping non-JavaScript file: $($item.Path)"
      continue
    }

    $targetFiles.Add($item.Path)
  }
}

if ($All) {
  $assetsJs = Join-Path $repoRoot 'assets/js'
  if (Test-Path -LiteralPath $assetsJs) {
    Get-ChildItem -LiteralPath $assetsJs -Recurse -File | ForEach-Object {
      if ($_.Extension -in '.js', '.mjs', '.cjs') {
        $targetFiles.Add($_.FullName)
      }
    }
  }
}

foreach ($path in $Paths) {
  Add-ResolvedFile -InputPath $path
}

$resolvedUniqueFiles = $targetFiles | Sort-Object -Unique
if (-not $resolvedUniqueFiles -or $resolvedUniqueFiles.Count -eq 0) {
  Write-Host 'Usage: .\\scripts\\nodecheck.ps1 <file.js> [more files]' -ForegroundColor Yellow
  Write-Host '   or: .\\scripts\\nodecheck.ps1 -All' -ForegroundColor Yellow
  Write-Host ''
  Write-Host 'This script resolves absolute paths before calling node --check,'
  Write-Host 'which avoids the Access is denied error seen with repo-relative paths'
  Write-Host 'in the OneDrive/Desktop Velvet workspace.'
  exit 1
}

$exitCode = 0
foreach ($file in $resolvedUniqueFiles) {
  Write-Host "Checking $file" -ForegroundColor Cyan
  & $nodeCommand.Source --check $file
  if ($LASTEXITCODE -ne 0) {
    $exitCode = $LASTEXITCODE
  }
}

exit $exitCode
