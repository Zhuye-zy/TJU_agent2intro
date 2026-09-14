# A-R2 → M：手动起点的来源枚举

## 现状

`shared/r2.ts` 的 `UserPosition.source` 目前只能取 `amap_geolocation`。A-R2 页面可以诚实地记录用户手动输入的 GCJ-02 起点，但不能在不冒充高德定位的前提下把它提交给 `POST /api/r2/routes/walking`。

因此当前实现将手动起点标为 `manual`，只用于页面参考，并禁用应用内路线；授权且非粗略的高德定位仍按现有契约提交。

## 请求 M 协调的契约变更

若本轮需要支持“手动起点 → 应用内步行规划”，请把 `UserPosition.source` 扩展为：

```ts
source: 'amap_geolocation' | 'manual'
```

同时请 C 对 `manual` 来源保持独立校验和日志标识，不把它记作 GPS。A 收到协调提交后再开放对应按钮与请求。

