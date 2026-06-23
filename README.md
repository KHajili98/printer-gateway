# Print Gateway Service

Restoran LAN-ında XPrinter termal printerlərə çap relay agenti.

## Hazır quraşdırıcılar (Node.js lazım deyil)

Build etdikdən sonra `dist/` qovluğunda:

| Fayl | Platform | İstifadə |
|------|----------|----------|
| `PrintGateway-Setup-*-win-x64.zip` | Windows | Zip aç → `Install.bat` |
| `PrintGateway-Setup-*-win-x64.exe` | Windows | NSIS installer (Windows-da build) |
| `PrintGateway-Setup-*-linux-x64.tar.gz` | Linux | `tar -xzf ... && ./install.sh` |

> **Qeyd:** `.dmg` macOS üçündür. Linux üçün `.tar.gz` istifadə edin.

### Build (developer)

```bash
npm run build
# → dist/PrintGateway-Setup-1.0.0-win-x64.zip
# → dist/PrintGateway-Setup-1.0.0-linux-x64.tar.gz
```

GitHub Actions ilə avtomatik build: **Actions → Build Release → Run workflow**

---

## Windows quraşdırma

1. `PrintGateway-Setup-*-win-x64.zip` faylını PC-yə kopyalayın
2. Zip-i açın
3. **`Install.bat`**-a iki dəfə klik edin
4. Brauzer avtomatik açılır → **http://localhost:3000/setup**

Node.js **daxildir** — ayrıca quraşdırmaya ehtiyac yoxdur.

## Linux quraşdırma

```bash
tar -xzf PrintGateway-Setup-*-linux-x64.tar.gz -C print-gateway
cd print-gateway
chmod +x install.sh start.sh stop.sh
./install.sh
```

Sistem servisi (root):
```bash
sudo ./install.sh
```

---

## Konfiqurasiya UI

Setup paneli: **http://localhost:3000/setup**

- API açarı, printer IP-ləri, LAN scan, test çap
- Yalnız localhost-dan əlçatan

## Django inteqrasiyası

```env
PRINT_GATEWAY_ENABLED=true
PRINT_GATEWAY_URL=http://192.168.x.x:3000
PRINT_GATEWAY_API_KEY=<setup panelindən>
```

## Mənbə kodundan işlətmə (developer)

```bash
cp .env.example .env
npm install
npm start
# və ya: ./install.sh (Node.js 18+ lazımdır)
```
