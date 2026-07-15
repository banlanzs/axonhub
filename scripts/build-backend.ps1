param(
    [string]$Version = "",
    [string]$RepoUrl = "https://github.com/looplj/axonhub",
    [string]$Output = "axonhub.exe"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Version)) {
    try {
        $url = & curl.exe -fsSL -o NUL -w "%{url_effective}" "$RepoUrl/releases/latest"
        if ($LASTEXITCODE -eq 0 -and $url) {
            $Version = ($url -split "/")[-1]
        }
    } catch {
        $Version = ""
    }
}

if ($Version) {
    Write-Host "Using version: $Version"
    $ldflags = "-s -w -X github.com/looplj/axonhub/internal/build.Version=$Version"
} else {
    Write-Host "Warning: failed to fetch latest release version, falling back to embedded VERSION file"
    $ldflags = "-s -w"
}

& go build -ldflags $ldflags -tags=nomsgpack -o $Output ./cmd/axonhub
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
