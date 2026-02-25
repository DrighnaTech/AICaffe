# AICaffe Backend Services Startup Script
# Run this from: C:\Users\SauravKumarJha\AICaffe\

$ROOT = "C:\Users\SauravKumarJha\AICaffe"
$VENV_PYTHON = "$ROOT\services\venv\Scripts\python.exe"
$VENV_UVICORN = "$ROOT\services\venv\Scripts\uvicorn.exe"

$services = @(
    @{ name = "auth-service";           port = 8001 },
    @{ name = "model-registry";         port = 8002 },
    @{ name = "token-service";          port = 8003 },
    @{ name = "recommendation-engine";  port = 8004 },
    @{ name = "news-aggregator";        port = 8005 },
    @{ name = "ai-proxy-service";       port = 8006 },
    @{ name = "billing-service";        port = 8007 },
    @{ name = "api-gateway";            port = 8000 }
)

Write-Host "Starting AICaffe Backend Services..." -ForegroundColor Cyan

foreach ($svc in $services) {
    $svcPath = "$ROOT\services\$($svc.name)"
    $port = $svc.port
    $name = $svc.name

    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "cd '$svcPath'; $VENV_UVICORN main:app --host 0.0.0.0 --port $port --env-file '$ROOT\.env'"
    ) -WindowStyle Normal

    Write-Host "  Started $name on port $port" -ForegroundColor Green
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "All services started!" -ForegroundColor Cyan
Write-Host "API Gateway:  http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "Auth Service: http://localhost:8001/docs" -ForegroundColor Yellow
Write-Host ""
Write-Host "Now run the frontend: cd frontend && npm run dev" -ForegroundColor Magenta
