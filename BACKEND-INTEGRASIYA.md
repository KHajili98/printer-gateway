# Print Gateway — Backend inteqrasiya sənədi

Bu sənəd **Print Gateway** (Node.js, restoran PC-də) ilə **Django backend** arasında çap inteqrasiyasını izah edir.

Restoranda çap işləmədiyi üçün bu sənəd hazırlanıb: gateway tərəfində nə hazırdır, backend nə göndərməlidir və lokal testdə hansı problemlər tapılıb.

---

## 1. Problem və həll

### Köhnə model (işləmir — cloud server)

```
Django (remote) ──X──► XPrinter (192.168.x.x:9100)
```

Remote server restoranın lokal IP-sinə çata bilmir. Ona görə `service_v2.py`-dakı birbaşa TCP socket cloud-dan **heç vaxt işləməyəcək**.

### Yeni model (Print Gateway)

```
Django (cloud) ──HTTP/WSS──► Print Gateway (restoran PC, LAN-da)
                                    │
                                    └── TCP :9100 ──► XPrinter
```

- **Çek formatlaşdırması** Django-da qalır (`service_v2.py`).
- Gateway yalnız **hazır `text` string** alır və printerə göndərir.
- Frontend/Admin API-ləri **dəyişmir** — arxa planda çap gateway-ə gedir.

---

## 2. Gateway hazırda nə edir?

| Komponent | Status | Qeyd |
|-----------|--------|------|
| TCP sender (cp857, AZ mapping, cut, beep) | ✅ | `service_v2.py` ilə eyni qaydalar |
| `POST /api/v1/print` | ✅ | Bearer auth |
| `POST /api/v1/print/batch` | ✅ | Worker printerlər |
| `POST /api/v1/test` | ✅ | Test səhifəsi |
| `GET /api/v1/health` | ✅ | Auth lazım deyil |
| `GET /api/v1/printers/scan` | ✅ | LAN scan |
| Outbound WebSocket client | ✅ | `print_job` / `print_result` |
| Idempotency (`X-Request-Id`) | ✅ | 1 saat cache |
| Rate limit | ✅ | 60 sorğu/dəqiqə |
| Setup UI | ✅ | `http://localhost:3000/setup` |

**Backend tərəfində** (`PrintGatewayClient`, `PRINT_GATEWAY_ENABLED` və s.) hələ tam inteqrasiya edilməyibsə, cloud-dan çap **gateway-ə çatmayacaq** — bu ən çox ehtimal olunan səbəbdir.

---

## 3. Əlaqə rejimləri

Gateway `.env`-də `MODE` ilə idarə olunur:

| MODE | Təsvir |
|------|--------|
| `http` | Yalnız REST API (port 3000) |
| `websocket` | Yalnız backend-ə outbound WSS |
| `both` | Hər ikisi (tövsiyə olunur) |

### Variant A — WebSocket (tövsiyə olunur, NAT-friendly)

Gateway **özü** backend-ə qoşulur. Port forwarding lazım deyil.

```
wss://api.qonaqbaku.az/ws/print-gateway/?token=<GATEWAY_TOKEN>&location_id=<LOCATION_ID>
```

Backend job göndərir → gateway çap edir → `print_result` qaytarır.

### Variant B — HTTP (Django → Gateway)

Django birbaşa restoran PC-yə HTTP POST göndərməlidir:

```
http://192.168.x.x:3000/api/v1/print
```

Bu yalnız Django **eyni LAN-da** və ya **VPN/tunnel** vasitəsilə gateway-ə çatanda işləyir. Cloud server birbaşa `192.168.x.x`-ə çata bilmir.

**MVP tövsiyəsi:** WebSocket rejimi (`MODE=websocket` və ya `both`).

---

## 4. REST API — dəqiq kontrakt

Bütün protected endpoint-lər üçün:

```
Authorization: Bearer <PRINT_GATEWAY_API_KEY>
Content-Type: application/json
```

Opsional (idempotency):

```
X-Request-Id: <uuid>
```

### `POST /api/v1/print`

**Request body:**

```json
{
  "text": "================================\n        Qonaq Baku\n...",
  "target": {
    "type": "main"
  },
  "meta": {
    "receipt_type": "customer",
    "table_id": 12,
    "order_ids": [101, 102],
    "source": "frontend"
  }
}
```

**`target.type` dəyərləri:**

| type | Body | Təsvir |
|------|------|--------|
| `main` | `{ "type": "main" }` | `config/printers.json`-dakı əsas printer |
| `ip` | `{ "type": "ip", "ip": "192.168.1.80", "port": 9100 }` | Birbaşa IP (Django `Printer` modelindən) |
| `name` | `{ "type": "name", "name": "Mətbəx" }` | Worker adı ilə lookup |

**Uğurlu cavab (200):**

```json
{
  "success": true,
  "message": "Çek uğurla çap edildi.",
  "printer": {
    "ip": "192.168.1.80",
    "port": 9100,
    "name": "Kassa printer"
  },
  "durationMs": 142
}
```

**Printer offline (502):**

```json
{
  "success": false,
  "message": "Printerə qoşulmaq mümkün olmadı.",
  "error": "ECONNREFUSED"
}
```

**Validation (400):**

```json
{
  "success": false,
  "message": "text is required."
}
```

**Auth (401):**

```json
{
  "success": false,
  "message": "Unauthorized."
}
```

**API key konfiqurasiya olunmayıb (500):**

```json
{
  "success": false,
  "message": "PRINT_GATEWAY_API_KEY is not configured."
}
```

> **Diqqət:** Gateway cavabında `durationMs` (camelCase) istifadə olunur. Spec README-də `duration_ms` yazılıbsa, backend parser-i buna uyğunlaşdırın.

---

### `POST /api/v1/print/batch`

```json
{
  "jobs": [
    {
      "text": "...",
      "target": { "type": "ip", "ip": "192.168.1.51", "port": 9100 },
      "meta": { "receipt_type": "preparation", "preparation_place": "Mətbəx" }
    }
  ]
}
```

Hər job üçün `text` və `target` **məcburidir**.

---

### `GET /api/v1/health`

Auth lazım deyil.

```json
{
  "status": "ok",
  "uptimeSec": 86400,
  "printers": {
    "main": { "ip": "192.168.1.80", "port": 9100, "reachable": true },
    "workers": [
      { "name": "Mətbəx", "ip": "192.168.1.51", "port": 9100, "reachable": false }
    ]
  }
}
```

> **Diqqət:** `uptimeSec` (camelCase). Spec-də `uptime_sec` varsa, uyğunlaşdırın.

---

### `POST /api/v1/test`

```json
{
  "target": { "type": "main" }
}
```

---

## 5. WebSocket protokolu

### Qoşulma URL

```
wss://api.qonaqbaku.az/ws/print-gateway/?token=<GATEWAY_TOKEN>&location_id=<LOCATION_ID>
```

Query parametrləri:
- `token` — lokasiya üçün unikal token (backend verir)
- `location_id` — restoran/lokasiya ID

### Backend → Gateway (job)

```json
{
  "type": "print_job",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "payload": {
    "text": "...",
    "target": { "type": "main" },
    "meta": { "receipt_type": "customer", "table_id": 5 }
  }
}
```

### Gateway → Backend (nəticə)

Uğurlu:

```json
{
  "type": "print_result",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "success": true,
  "status_code": 200,
  "message": "Çek uğurla çap edildi.",
  "printer": { "ip": "192.168.1.80", "port": 9100, "name": "Kassa printer" },
  "duration_ms": 142
}
```

Uğursuz:

```json
{
  "type": "print_result",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "success": false,
  "status_code": 502,
  "message": "Printerə qoşulmaq mümkün olmadı.",
  "error": "ECONNREFUSED"
}
```

> WebSocket cavabında `duration_ms` (snake_case), REST cavabında isə `durationMs` (camelCase) — inconsistency var, backend hər ikisini handle etməlidir.

### Heartbeat (hər 30 saniyə)

Gateway → Backend:

```json
{
  "type": "heartbeat",
  "printers_status": {
    "main": true,
    "workers": [
      { "name": "Mətbəx", "ip": "192.168.1.51", "reachable": true }
    ]
  }
}
```

Backend bu heartbeat-i qəbul edib gateway-in online/offline statusunu izləməlidir.

---

## 6. ESC/POS protokolu (gateway printerə nə göndərir)

Gateway `service_v2.py` ilə **eyni** qaydada işləyir:

| Parametr | Dəyər |
|----------|-------|
| Protokol | Raw TCP |
| Port | 9100 |
| Encoding | cp857 (`iconv-lite`) |
| AZ simvollar | `ə→e`, `ş→s`, `ç→c`, ... |
| Kəsmə | `\x1D\x56\x00` |
| Səs | `\x1B\x42\x03\x02` (3 beep) |
| Timeout | 5 saniyə |

Django çek mətnini formatlaşdırır, gateway **heç bir formatlaşdırma etmir** — mətn olduğu kimi ötürülür.

---

## 7. Django inteqrasiya — backend nə etməlidir?

### 7.1 Settings

```python
PRINT_GATEWAY_ENABLED = env.bool("PRINT_GATEWAY_ENABLED", default=False)
PRINT_GATEWAY_URL = env("PRINT_GATEWAY_URL", default="http://127.0.0.1:3000")
PRINT_GATEWAY_API_KEY = env("PRINT_GATEWAY_API_KEY", default="")
PRINT_GATEWAY_MODE = env("PRINT_GATEWAY_MODE", default="websocket")  # http | websocket
PRINT_GATEWAY_TIMEOUT = env.int("PRINT_GATEWAY_TIMEOUT", default=10)
```

### 7.2 `PrintGatewayClient` (HTTP rejimi)

```python
import requests
from django.conf import settings

class PrintGatewayClient:
    @staticmethod
    def send(text, target=None, meta=None):
        if not settings.PRINT_GATEWAY_ENABLED:
            return None  # fallback: birbaşa socket

        payload = {
            "text": text,
            "target": target or {"type": "main"},
            "meta": meta or {},
        }
        resp = requests.post(
            f"{settings.PRINT_GATEWAY_URL}/api/v1/print",
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.PRINT_GATEWAY_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=settings.PRINT_GATEWAY_TIMEOUT,
        )
        return resp
```

### 7.3 `service_v2.py` minimal dəyişiklik

```python
@staticmethod
def _send_text_to_printer(text, ip_address, port):
    from apps.printers.utils.gateway_client import PrintGatewayClient
    from django.conf import settings

    if settings.PRINT_GATEWAY_ENABLED:
        resp = PrintGatewayClient.send(
            text=text,
            target={"type": "ip", "ip": ip_address, "port": port},
        )
        if resp is None:
            pass  # fallback
        elif resp.ok:
            return DummyResponse(resp.status_code)
        else:
            return DummyResponse(resp.status_code)

    # mövcud socket kodu (lokal dev fallback)
    ...
```

### 7.4 WebSocket rejimi (backend tərəfi)

Backend-də `/ws/print-gateway/` consumer lazımdır:

1. Gateway qoşulanda `token` + `location_id` yoxla
2. Print job lazım olanda `print_job` mesajı göndər
3. `print_result` gözlə
4. `heartbeat` mesajlarını qəbul et

**Vacib:** WebSocket rejimində Django **gateway-ə HTTP çağırmır** — əksinə, gateway Django-ya qoşulur və job-ları gözləyir.

---

## 8. Restoran PC konfiqurasiyası

Setup paneli: `http://localhost:3000/setup` (yalnız localhost)

| Parametr | Harada | Nümunə |
|----------|--------|--------|
| API açarı | Setup UI / `.env` | `PRINT_GATEWAY_API_KEY` |
| Backend WS URL | Setup UI / `.env` | `wss://api.qonaqbaku.az/ws/print-gateway/` |
| Gateway token | Setup UI / `.env` | Backend-dən verilən lokasiya tokeni |
| Location ID | Setup UI / `.env` | `1` |
| Mode | Setup UI / `.env` | `both` |
| Əsas printer IP | Setup UI / `config/printers.json` | `192.168.1.80` |
| Printer port | Setup UI | `9100` |

**Hazırkı test konfiqurasiyası (işləyir):**

```json
{
  "main": {
    "name": "Kassa printer",
    "ip": "192.168.1.80",
    "port": 9100
  },
  "workers": []
}
```

---

## 9. Lokal testdə tapılan problemlər (gateway tərəfi)

Restoranda çap işləmədi — aşağıdakı səbəblər yoxlanıldı və düzəldildi:

### 9.1 Yanlış printer IP (əsas səbəb)

| Vəziyyət | Dəyər |
|----------|-------|
| Config-də saxlanmış (köhnə) | `192.168.1.50` — offline |
| Real printer (kassa) | `192.168.1.80` — online |

Setup formunda IP dəyişdirilib, amma **Saxla** basılmamışdı. Test çap formdakı dəyəri yox, **saxlanmış config**-i oxuyurdu.

**Həll:** IP `192.168.1.80` olaraq saxlanıldı → test çap uğurlu (≈5ms).

### 9.2 LAN scan yanlış format

Scan sahəsinə tam IP (`192.168.1.80`) yazılıb. Düzgün format **subnet prefiksi**dir:

| Yanlış | Düzgün |
|--------|--------|
| `192.168.1.80` | `192.168.1.` |

Scan `192.168.1.80` ilə `192.168.1.801`, `192.168.1.802` ... skan edir — etibarsız ünvanlar.

### 9.3 WiFi vs kabel

Problem WiFi deyildi. PC (`192.168.1.201`) və printer (`192.168.1.80`) eyni subnet-də idi, port 9100 açıq idi.

---

## 10. "Backend servisimlə çap işləmir" — yoxlama siyahısı

Backend developer bu addımları yoxlasın:

### Gateway tərəfi (restoran PC)

- [ ] Print Gateway işləyir: `curl http://localhost:3000/api/v1/health`
- [ ] Printer `reachable: true` göstərir
- [ ] `PRINT_GATEWAY_API_KEY` setup-da doldurulub
- [ ] `BACKEND_WS_URL` və `GATEWAY_TOKEN` düzgündür
- [ ] `MODE=both` və ya `websocket` (cloud HTTP birbaşa çatmayacaqsa)
- [ ] Test çap işləyir: setup panelindən və ya `POST /api/v1/test`

### Backend tərəfi (Django)

- [ ] `PRINT_GATEWAY_ENABLED=true` production/staging-də
- [ ] `PrintGatewayClient` implement edilib
- [ ] `service_v2._send_text_to_printer` gateway-ə yönləndirilib
- [ ] API key gateway `.env` ilə **eyni**dir
- [ ] WebSocket rejimində: `/ws/print-gateway/` consumer işləyir
- [ ] WebSocket rejimində: gateway backend loglarında "connected" görünür
- [ ] HTTP rejimində: Django gateway URL-ə **fiziki çata bilir** (VPN/tunnel/LAN)
- [ ] Cloud server hələ də birbaşa `192.168.x.x:9100`-ə socket açmır (köhnə kod)

### Tez test (backend olmadan)

Restoran PC-dən:

```bash
# Health
curl http://localhost:3000/api/v1/health

# Test çap (API key setup panelindən)
curl -X POST http://localhost:3000/api/v1/test \
  -H "Authorization: Bearer <PRINT_GATEWAY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"target":{"type":"main"}}'

# Real mətn
curl -X POST http://localhost:3000/api/v1/print \
  -H "Authorization: Bearer <PRINT_GATEWAY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"text":"Test\n\n\n","target":{"type":"main"}}'
```

Bu curl-lər işləyirsə, gateway + printer **tam hazırdır**. Problem backend inteqrasiyasındadır.

---

## 11. Axın diaqramı

### Frontend çap (HTTP rejimi, Django eyni LAN-da və ya tunnel ilə)

```
Frontend
  └─ POST /api/orders/{tableId}/print-check/
       └─ PrintCheckAPIView
            └─ PrinterService.print_orders_for_table()
                 └─ _format_customer_receipt()   ← Django formatlaşdırır
                 └─ PrintGatewayClient.send()    ← Backend əlavə etməlidir
                      └─ POST http://gateway:3000/api/v1/print
                           └─ Gateway TCP → XPrinter
```

### WebSocket rejimi (cloud-friendly)

```
Django (print job yaradır)
  └─ WebSocket: { type: "print_job", job_id, payload }
       └─ Gateway (artıq qoşulub)
            └─ executePrint(payload)
                 └─ TCP → XPrinter
            └─ WebSocket: { type: "print_result", job_id, success, ... }
```

---

## 12. Spec vs implementasiya fərqləri

Backend spec README (`print_gateway/README.md`) ilə faktiki gateway arasında kiçik fərqlər:

| Sahə | Spec README | Faktiki gateway |
|------|-------------|-----------------|
| Health uptime | `uptime_sec` | `uptimeSec` |
| Print duration (REST) | `duration_ms` | `durationMs` |
| Print duration (WS) | `duration_ms` | `duration_ms` ✅ |

Backend parser-i hər iki formatı dəstəkləməlidir.

---

## 13. Nəticə

**Gateway tərəfi hazırdır və test edilib:**
- Printer `192.168.1.80:9100` əlçatandır
- Test çap uğurlu
- REST API + WebSocket client implement edilib
- ESC/POS encoding `service_v2.py` ilə uyğundur

**Çap backend servisi ilə işləmirsə**, ən ehtimal səbəblər:

1. Backend hələ `PRINT_GATEWAY_ENABLED` aktiv etməyib / `PrintGatewayClient` yoxdur
2. Cloud server birbaşa printer IP-sinə socket açmağa davam edir (köhnə yol)
3. WebSocket consumer backend-də yoxdur və ya token/location_id uyğun gəlmir
4. HTTP rejimində Django gateway-ə network səviyyəsində çata bilmir

Backend komandasından xahiş: bu sənədə əsasən inteqrasiyanı tamamlasın və WebSocket qoşulmasını log-larda təsdiqləsin.

---

## Əlaqəli fayllar

| Layihə | Fayl |
|--------|------|
| Gateway (Node.js) | `src/server/http.js`, `src/server/ws-client.js`, `src/jobs/processor.js` |
| Gateway spec | `print_gateway/README.md` (backend repo) |
| Backend çap | `apps/printers/utils/service_v2.py` |
| Backend API | `apps/printers/apis.py` |
