# Carica SOLO English Sprint su www.gianlucadario.com/apps/english-sprint, via FTP, con il sito salvato in WinSCP
# "GIANLUCADARIO.com aruba" (la password resta dentro WinSCP: questo script non la legge e non la chiede).
#   carica.bat          -> compila, prova (mostra cosa cambierebbe) e chiede conferma prima di caricare
#   carica.bat -Subito  -> compila e carica senza chiedere (l'app è pubblica: pagina e api/?r=session rispondono 200 anche senza login)
# Non cancella mai niente sul server e non tocca le altre app. Non carica sorgenti/.
param([switch]$Subito)
$ErrorActionPreference = "Stop"
$Sorgenti = Split-Path -Parent $PSScriptRoot
$App = Split-Path -Parent $Sorgenti
$WinScp = "C:\Program Files (x86)\WinSCP\WinSCP.com"
$SitoWinScp = "GIANLUCADARIO.com aruba"
$Esclusi = "| sorgenti/; *.log"

Push-Location $Sorgenti
try {
    npm run controlla; if ($LASTEXITCODE -ne 0) { throw "Le lezioni non passano il controllo: niente caricamento." }
    npm run build; if ($LASTEXITCODE -ne 0) { throw "Compilazione fallita." }
} finally { Pop-Location }

function WinScp($comandi) {
    $file = Join-Path $env:TEMP ("winscp-es-" + [guid]::NewGuid() + ".txt")
    $righe = @("option batch abort", "option confirm off", "open `"$SitoWinScp`"") + $comandi + @("exit")
    Set-Content -Path $file -Value $righe -Encoding UTF8
    try { & $WinScp /script="$file"; return $LASTEXITCODE } finally { Remove-Item $file -ErrorAction SilentlyContinue }
}

# radice del sito sul server: /www.gianlucadario.com oppure /
$radice = $null
foreach ($c in @("/www.gianlucadario.com", "")) {
    if ((WinScp @("stat `"$c/apps`"") | Select-Object -Last 1) -eq 0) { $radice = $c; break }
}
if ($null -eq $radice) { throw "Non riesco a collegarmi a '$SitoWinScp' o non trovo la cartella apps." }
$dest = "$radice/apps/english-sprint"
$sync = "synchronize remote -criteria=either -filemask=`"$Esclusi`" `"$App`" `"$dest`""

if (-not $Subito) {
    Write-Host "`nProva: ecco cosa cambierebbe su $dest" -ForegroundColor Cyan
    WinScp @("option batch continue", "mkdir `"$dest`"", "option batch abort", ($sync -replace "^synchronize remote ", "synchronize remote -preview ")) | Out-Null
    if ((Read-Host "Carico davvero? (s/n)") -ne "s") { Write-Host "Niente caricato."; exit 0 }
}
$codice = WinScp @("option batch continue", "mkdir `"$dest`"", "option batch abort", $sync) | Select-Object -Last 1
if ($codice -ne 0) { throw "WinSCP ha segnalato un errore." }

# controllo veloce dal web
foreach ($p in @("", "content/syllabus.json", "api/index.php?r=session")) {
    try { $r = Invoke-WebRequest -UseBasicParsing "https://www.gianlucadario.com/apps/english-sprint/$p" -TimeoutSec 20; Write-Host ("  " + $r.StatusCode + "  /apps/english-sprint/" + $p) -ForegroundColor Green }
    catch { Write-Host ("  ERRORE /apps/english-sprint/" + $p + ": " + $_.Exception.Message) -ForegroundColor Red }
}
Write-Host "Fatto." -ForegroundColor Green
