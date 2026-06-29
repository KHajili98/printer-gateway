# Print Gateway — Linux Quraşdırma Təlimatı

Bu təlimat restoran PC-sində (Linux) Print Gateway-i **Downloads** qovluğundan quraşdırmaq üçündür.

**Node.js lazım deyil** — hər şey paketin içindədir.

---

## 1. Fayl haradadır?

Adətən burada olur:

```
/home/SIZIN-ADINIZ/Downloads/PrintGateway-Setup-1.0.0-linux-x64.tar.gz
```

Ubuntu / Linux Mint / Debian istifadə edirsinizsə, adətən **`Downloads`** = **`Yükləmələr`**.

---

## 2. Terminali açın

- **Ubuntu / Mint:** `Ctrl + Alt + T`
- və ya proqramlar menyusunda **Terminal** axtarın

---

## 3. Downloads qovluğuna keçin

Terminalda bunu yazın və **Enter** basın:

```bash
cd ~/Downloads
```

Yoxlamaq üçün:

```bash
ls -lh PrintGateway-Setup-*.tar.gz
```

Fayl siyahıda görünməlidir.

---

## 4. Arxivi açın (extract)

### Variant A — Manual (GUI) — terminal işləmirsə

1. **Fayllar** (Files) proqramını açın
2. Sol tərəfdən **Downloads / Yükləmələr** seçin
3. `PrintGateway-Setup-1.0.0-linux-x64.tar.gz` faylını tapın
4. Fayla **sağ klik** → birini seçin:
   - **Extract Here** (Buraya çıxart) — fayllar Downloads-da qalır
   - **Extract to...** (Buraya çıxart...) — `print-gateway` adlı qovluq seçin/yaradın

5. Extract bitəndən sonra qovluqda bunlar olmalıdır:
   ```
   install.sh
   start.sh
   stop.sh
   app/
   node/
   README.txt
   ```

> **Vacib:** Əgər "Extract Here" etdinizsə, fayllar birbaşa `Downloads`-da olacaq (`install.sh` Downloads-da görünür). Sonra terminalda `cd ~/Downloads` yazın.

> **Extract Here** etdikdə `install.sh` birbaşa Downloads-da görünürsə — problem yoxdur, `cd ~/Downloads` kifayətdir.

### Variant B — Terminal ilə

```bash
mkdir -p ~/print-gateway
tar -xzf PrintGateway-Setup-1.0.0-linux-x64.tar.gz -C ~/print-gateway
```

Bu əmr:
- `~/print-gateway` qovluğu yaradır
- arxivin içindəkiləri ora çıxarır (`install.sh`, `node/`, `app/` və s.)

---

## 5. Quraşdırma qovluğuna keçin

Extract etdiyiniz qovluğa keçin:

```bash
cd ~/Downloads
```

və ya ayrıca qovluq yaratdınızsa:

```bash
cd ~/print-gateway
```

**GUI-dən terminal açmaq:** Extract olunan qovluqda boş yerdə **sağ klik** → **Open in Terminal** / **Terminalda aç**

Yoxlamaq:

```bash
ls
```

Görməlisiniz: `install.sh`  `start.sh`  `stop.sh`  `app`  `node`  `README.txt`

---

## 6. Skriptlərə icazə verin

```bash
chmod +x install.sh start.sh stop.sh
```

(Bir dəfə etmək kifayətdir.)

---

## 7. Quraşdırın

### Variant A — Adi istifadəçi (restoran PC, sudo yox)

```bash
./install.sh
```

Bu:
- servisi arxa planda başladır
- kompüter açılanda avtomatik işləməsi üçün qeydiyyat edir
- brauzerdə setup panelini açmağa çalışır

### Variant B — Sistem servisi (tövsiyə: restoran PC)

Daha etibarlıdır — PC restart olanda avtomatik qalxır:

```bash
sudo ./install.sh
```

Parol soruşacaq — daxil edin.

---

## 8. Konfiqurasiya (Setup UI)

Brauzer açılmadısa, əl ilə açın:

**http://localhost:3000/setup**

Burada:
1. **API açarı** — Django üçün (kopyalayın)
2. **Əsas printer IP** — kassa printer (məs: `192.168.1.50`)
3. **İşçi printerlər** — mətbəx/bar
4. **Scan** — LAN-da printer tapmaq
5. **Test çap** — yoxlama
6. **Saxla** düyməsi

---

## 9. Yoxlama

Terminalda:

```bash
curl http://localhost:3000/api/v1/health
```

Cavabda `"status":"ok"` görməlisiniz.

---

## Gündəlik əmrlər

| Əməliyyat | Əmr |
|-----------|-----|
| Başlat | `cd ~/print-gateway && ./start.sh` |
| Dayandır | `cd ~/print-gateway && ./stop.sh` |
| Setup paneli | Brauzer: http://localhost:3000/setup |
| Loglar (user mode) | `cat ~/print-gateway/gateway.log` |
| Servis statusu (sudo quraşdırma) | `sudo systemctl status print-gateway` |
| Servisi restart | `sudo systemctl restart print-gateway` |

---

## Tez-tez verilən suallar

### `tar: Error opening archive` — fayl tapılmır

Downloads-da deyilsiniz və ya fayl adı fərqlidir:

```bash
cd ~/Downloads
ls PrintGateway*
```

Düzgün adı `tar` əmrində yazın.

### `Permission denied` — `./install.sh` işləmir

```bash
chmod +x install.sh start.sh stop.sh
./install.sh
```

### Setup səhifəsi açılmır

Servis işləyirmi yoxlayın:

```bash
curl http://localhost:3000/api/v1/health
```

İşləmirsə:

```bash
cd ~/print-gateway
./start.sh
```

### Printer offline göstərir

- PC və printer **eyni WiFi / eyni kabellə** eyni şəbəkədə olmalıdır
- Printer IP-ni setup panelində düzgün yazın
- Port: `9100` (XPrinter default)

### Django ilə əlaqə

Django server `.env`-də:

```env
PRINT_GATEWAY_ENABLED=true
PRINT_GATEWAY_URL=http://192.168.X.X:3000
PRINT_GATEWAY_API_KEY=<setup panelindən kopyaladığınız açar>
```

`192.168.X.X` — **Print Gateway-in quraşdırıldığı restoran PC-nin** lokal IP-si.

PC IP-ni öyrənmək:

```bash
hostname -I
```

---

## Tam əmr ardıcıllığı (copy-paste)

Aşağıdakı blokları **bir-bir** terminala yapışdırın:

```bash
cd ~/Downloads
```

```bash
mkdir -p ~/print-gateway
tar -xzf PrintGateway-Setup-1.0.0-linux-x64.tar.gz -C ~/print-gateway
```

```bash
cd ~/print-gateway
chmod +x install.sh start.sh stop.sh
sudo ./install.sh
```

Sonra brauzerdə: **http://localhost:3000/setup**

---

## Fayl strukturu

```
~/print-gateway/
├── install.sh      ← quraşdırma
├── start.sh        ← başlat
├── stop.sh         ← dayandır
├── node/           ← daxili Node.js ( toxunmayın )
├── app/            ← servis kodu
│   ├── src/
│   ├── public/setup/   ← UI faylları
│   └── config/printers.json
└── gateway.log     ← log (quraşdırmadan sonra yaranır)
```
