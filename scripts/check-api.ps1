param([int]$Port=8000,[switch]$Chat)
$ErrorActionPreference='Stop'
$base="http://127.0.0.1:$Port"
$health=Invoke-RestMethod "$base/api/health" -TimeoutSec 10
$status=Invoke-RestMethod "$base/api/knowledge/status" -TimeoutSec 10
[pscustomobject]@{http=$health.status;model_configured=$health.model.configured;model_verified=$health.model.verified;knowledge=$status.status;documents=$status.document_count;buildings=$status.building_count} | Format-List
if ($Chat) {
 $body=@{request_id=[guid]::NewGuid().ToString();session_id=[guid]::NewGuid().ToString();message='请用一句话介绍你作为校园导游的职责。';mode='general_chat';campus_id='weijinlu';selected_building_id=$null} | ConvertTo-Json
 $response=Invoke-RestMethod "$base/api/chat" -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 135
 [pscustomobject]@{answer=$response.answer;model=$response.model;elapsed_ms=$response.elapsed_ms;usage=$response.usage} | ConvertTo-Json
}
