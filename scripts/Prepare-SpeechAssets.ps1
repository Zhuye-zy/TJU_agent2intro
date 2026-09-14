$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$vad=Join-Path $root 'frontend\public\vendor\vad'
$ort=Join-Path $root 'frontend\public\vendor\ort'
[IO.Directory]::CreateDirectory($vad) | Out-Null
[IO.Directory]::CreateDirectory($ort) | Out-Null
foreach ($name in @('vad.worklet.bundle.min.js','silero_vad_legacy.onnx','silero_vad_v5.onnx','silero_vad_v6.onnx')) {
 Copy-Item -LiteralPath (Join-Path $root "node_modules\@ricky0123\vad-web\dist\$name") -Destination (Join-Path $vad $name)
}
foreach ($name in @('ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm')) {
 Copy-Item -LiteralPath (Join-Path $root "node_modules\onnxruntime-web\dist\$name") -Destination (Join-Path $ort $name)
}
Write-Host 'Local VAD/CPU WASM assets prepared; microphone/ASR not verified.'
