# คู่มือการติดตั้งและ Deploy ระบบบน Cloud VPS (Ubuntu 22.04 LTS)
### รองรับ Multi-Domain (`kuayrai.com`, `twiniiz.com`) & Multi-Subdomain ด้วย PM2 + Nginx + Docker

---

## 🏗️ ภาพรวมโครงสร้างระบบ (Architecture Overview)

```
                       [ ผู้ใช้งาน / Browser ]
                                  │
                                  ▼
                 [ Cloudflare / Domain DNS ]
                 (kuayrai.com, twiniiz.com)
                                  │
                                  ▼
     ┌────────────────── เซิร์ฟเวอร์ VPS (Ubuntu 22.04) ──────────────────┐
     │                                                                   │
     │  🔒 UFW Firewall (เปิดเฉพาะ Port 22 SSH, 80 HTTP, 443 HTTPS)        │
     │                                                                   │
     │  🌐 Nginx Reverse Proxy (พอร์ต 80, 443 + SSL Certbot)              │
     │     ├── keelek.kuayrai.com ──► Static: /var/www/keelek/frontend/dist │
     │     │                      ──► API/Socket: 127.0.0.1:3000          │
     │     ├── [อนาคต] app2.kuayrai.com ─► API: 127.0.0.1:3001            │
     │     └── [อนาคต] app.twiniiz.com  ─► API: 127.0.0.1:3002            │
     │                                                                   │
     │  ⚡ PM2 Process Manager (ทำงานเบื้องหลัง + Auto-start เมื่อรีบูต)    │
     │     ├── keelek-backend    (Port 3000)                             │
     │     ├── [อนาคต] app2-backend (Port 3001)                          │
     │     └── [อนาคต] twiniiz-app  (Port 3002)                          │
     │                                                                   │
     │  🐳 Docker Engine (MySQL & Database Services)                     │
     │     └── mysql-kuayrai (Port 127.0.0.1:3306 - ปิดกั้นภายนอก)        │
     │                                                                   │
     │  💾 Swap Memory 4GB (ป้องกัน Out-Of-Memory ช่วยให้ RAM 4GB นิ่ง)  │
     └───────────────────────────────────────────────────────────────────┘
```

---

## 📋 ข้อมูลสเปกเครื่องเซิร์ฟเวอร์
- **CPU**: 2 vCores
- **RAM**: 4 GB (+ Swap 4 GB)
- **SSD**: 60 GB
- **OS**: Ubuntu 22.04 LTS (x86_64)
- **IP VPS**: *(ตรวจสอบจากอีเมลหรือ Dashboard ผู้ให้บริการ VPS)*
- **Domains**: `kuayrai.com`, `twiniiz.com`

---

## ขั้นตอนที่ 1: ตั้งค่า DNS ชี้โดเมน (Domain DNS Setup)

ล็อกอินเข้าไปที่เว็บที่คุณซื้อหรือจัดการ DNS (เช่น Cloudflare, GoDaddy, Namecheap, หรือเว็บ Hosting เดิม):
เพิ่ม **DNS Record** ดังนี้:

### โดเมน: `kuayrai.com`
| Type | Name / Host | Value / Target | Proxy status (ถ้าใช้ Cloudflare) |
| :--- | :--- | :--- | :--- |
| **A** | `keelek` | `<IP_VPS_ของคุณ>` | DNS Only (สีเทา) ในช่วงแรกเพื่อขอ SSL |
| **A** | `@` (หรือ kuayrai.com) | `<IP_VPS_ของคุณ>` | DNS Only (สีเทา) |
| **A** | `www` | `<IP_VPS_ของคุณ>` | DNS Only (สีเทา) |
| **A** | `*` (Wildcard สำหรับ subdomain ในอนาคต) | `<IP_VPS_ของคุณ>` | DNS Only (สีเทา) |

### โดเมน: `twiniiz.com` (ตั้งรอไว้ได้เลย หรือตั้งเมื่อพร้อมทำระบบใหม่)
| Type | Name / Host | Value / Target |
| :--- | :--- | :--- |
| **A** | `@` | `<IP_VPS_ของคุณ>` |
| **A** | `*` | `<IP_VPS_ของคุณ>` |

---

## ขั้นตอนที่ 2: เชื่อมต่อ SSH เข้า VPS จาก Mac

เปิดแอป **Terminal** บน Mac (กด `Cmd + Space` พิมพ์ `Terminal` แล้วกด `Enter`):

```bash
ssh root@<IP_VPS_ของคุณ>
```
- ระบบจะถามยืนยันการเชื่อมต่อครั้งแรก ให้พิมพ์ `yes` แล้วกด `Enter`
- ใส่รหัสผ่าน `root` ที่ได้รับจากผู้ให้บริการ VPS (ขณะพิมพ์รหัสผ่านเคอร์เซอร์จะไม่ขยับ เป็นเรื่องปกติของ Linux พิมพ์เสร็จแล้วกด `Enter`)

---

## ขั้นตอนที่ 3: ติดตั้งและตั้งค่าพื้นฐานเครื่องเซิร์ฟเวอร์

เมื่อล็อกอินเข้าไปในเครื่อง VPS เรียบร้อยแล้ว ให้รันคำสั่งตามลำดับนี้:

### 3.1 อัปเดตแพ็กเกจระบบ
```bash
apt update && apt upgrade -y
```

### 3.2 ตั้งค่า Swap Memory 4GB (สำคัญมากสำหรับ VPS 4GB ช่วยให้เครื่องไม่แฮงก์)
```bash
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 3.3 ติดตั้งโปรแกรมเครื่องมือจำเป็น
```bash
apt install -y git curl wget ufw nginx certbot python3-certbot-nginx htop
```

### 3.4 ติดตั้ง Node.js 20 LTS และ PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
```
*ตรวจเช็คเวอร์ชัน:* `node -v` และ `pm2 -v`

### 3.5 ติดตั้ง Docker และ Docker Compose
```bash
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin
systemctl enable --now docker
```
*ตรวจเช็คเวอร์ชัน:* `docker --version` และ `docker compose version`

### 3.6 ตั้งค่า Firewall (UFW) เพื่อความปลอดภัยสูงสุด
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
ufw status
```
*(หมายเหตุ: Port 3306 ของ MySQL จะปิดกั้นจากโลกภายนอก ให้เข้าได้เฉพาะ localhost ภายในเครื่องเท่านั้น)*

---

## ขั้นตอนที่ 4: นำโค้ดโปรเจกต์ขึ้นเซิร์ฟเวอร์

สร้างโฟลเดอร์สำหรับเก็บโปรเจกต์:
```bash
mkdir -p /var/www/keelek
cd /var/www/keelek
```

### เลือกวิธีนำโค้ดขึ้น (วิธีใดวิธีหนึ่ง):

#### วิธีที่ 4.1: ผ่าน GitHub (แนะนำ)
รันบน VPS:
```bash
git clone https://github.com/athanhomemail/keelek.git /var/www/keelek
```
*(หากเป็น Private Repo ให้ใช้ GitHub Personal Access Token หรือเพิ่ม SSH Deploy Key)*

#### วิธีที่ 4.2: คัดลอกจากเครื่อง Mac โดยตรง (rsync)
เปิดหน้าต่าง Terminal **แท็บใหม่บนเครื่อง Mac** แล้วรัน:
```bash
rsync -avz --exclude 'node_modules' --exclude 'dist' /Users/torz.athan/@Projects/Kuayrai/keelek/ root@<IP_VPS_ของคุณ>:/var/www/keelek/
```

---

## ขั้นตอนที่ 5: รัน Database MySQL ด้วย Docker

บน VPS เข้าไปที่โฟลเดอร์ Docker:
```bash
cd /var/www/keelek/Docker
docker compose up -d
```
*ตรวจเช็คสถานะฐานข้อมูล:*
```bash
docker ps
```
จะเห็น container ชื่อ `mysql-kuayrai` สถานะ `Up` (และระบบจะรัน SQLSchema สร้างตารางและข้อมูลเริ่มต้นให้อัตโนมัติ)

---

## ขั้นตอนที่ 6: รัน Backend ด้วย PM2

```bash
cd /var/www/keelek/backend

# สร้างไฟล์ .env
cp .env.example .env

# ติดตั้งแพ็กเกจ Backend
npm install --production=false

# ถอยมาที่ root เพื่อสั่งเริ่มการทำงานผ่าน PM2 Ecosystem
cd /var/www/keelek
pm2 start ecosystem.config.cjs

# บันทึกสถานะ PM2 และตั้งให้เริ่มทำงานอัตโนมัติเมื่อเซิร์ฟเวอร์เปิดใหม่
pm2 save
pm2 startup
# (คัดลอกคำสั่งที่ระบบแสดงขึ้นมาวางแล้วรันอีกครั้ง เพื่อผูก systemd service)
```

*คำสั่งตรวจสอบ Backend:*
```bash
pm2 status
pm2 logs keelek-backend --lines 30
```

---

## ขั้นตอนที่ 7: Build Frontend (Vite)

```bash
cd /var/www/keelek/frontend
npm install
npm run build
```
*(ระบบจะ compile และสร้างไฟล์เว็บสำเร็จรูปไว้ที่ `/var/www/keelek/frontend/dist`)*

---

## ขั้นตอนที่ 8: ตั้งค่า Nginx Reverse Proxy

นำไฟล์คอนฟิก Nginx ของโปรเจกต์ไปเปิดใช้งาน:
```bash
cp /var/www/keelek/nginx-keelek.conf /etc/nginx/sites-available/keelek.kuayrai.com

# สร้าง Symbolic Link ไปยัง sites-enabled
ln -s /etc/nginx/sites-available/keelek.kuayrai.com /etc/nginx/sites-enabled/

# ลบ default site ของ Nginx ออก
rm -f /etc/nginx/sites-enabled/default

# ทดสอบว่าไฟล์คอนฟิกถูกต้องหรือไม่
nginx -t

# รีโหลด Nginx เพื่อใช้งาน
systemctl reload nginx
```

---

## ขั้นตอนที่ 9: ขอ SSL Certificate ฟรี (HTTPS) ด้วย Certbot

เมื่อชี้ DNS มาที่ IP เซิร์ฟเวอร์เรียบร้อยแล้ว ให้รันคำสั่ง:
```bash
certbot --nginx -d keelek.kuayrai.com -d kuayrai.com -d www.kuayrai.com
```
- กรอก Email เพื่อรับแจ้งเตือนเมื่อใกล้หมดอายุ
- กด `Y` ยอมรับ Terms of Service
- Certbot จะตรวจสอบโดเมน ติดตั้ง SSL Certificate ให้ และปรับแต่ง Nginx ให้ Redirect จาก HTTP เป็น HTTPS ให้อัตโนมัติทันที
- SSL จะมีอายุ 90 วันและระบบมี Auto-renewal ทำงานอยู่เบื้องหลังตลอดเวลา

---

## 🚀 พิมพ์เขียว: การเพิ่มระบบใหม่ในอนาคต (Multi-Project Blueprint)

เมื่อคุณต้องการนำระบบใหม่มาลงในเครื่องนี้ เช่น:
- ระบบที่ 2: `lottery.kuayrai.com`
- ระบบที่ 3: `twiniiz.com` หรือ `shop.twiniiz.com`

ทำตาม 4 ขั้นตอนนี้ได้ทันที:

### 1. วางโค้ดในโฟลเดอร์ใหม่
```bash
mkdir -p /var/www/ระบบใหม่
# เอาโค้ดลงที่นี่
```

### 2. รัน Backend ใน PM2 ด้วย Port ใหม่ (เช่น 3001, 3002)
เพิ่มลงใน PM2 ด้วยคำสั่ง:
```bash
cd /var/www/ระบบใหม่/backend
pm2 start src/server.js --name "system2-backend" --env PORT=3001
pm2 save
```

### 3. สร้าง Nginx Config ใหม่ใน `/etc/nginx/sites-available/`
ตัวอย่างไฟล์ `/etc/nginx/sites-available/shop.twiniiz.com`:
```nginx
server {
    listen 80;
    server_name shop.twiniiz.com twiniiz.com;

    root /var/www/ระบบใหม่/frontend/dist;
    index index.html;
    client_max_body_size 25M;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001; # ชี้ไปพอร์ตของระบบนี้
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```
เปิดใช้งาน:
```bash
ln -s /etc/nginx/sites-available/shop.twiniiz.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 4. ขอ SSL HTTPS ให้ระบบใหม่
```bash
certbot --nginx -d shop.twiniiz.com -d twiniiz.com
```

---

## 🛠️ คำสั่งมีประโยชน์สำหรับตรวจสอบและดูแลระบบ (Cheat Sheet)

| คำสั่ง | ประโยชน์ |
| :--- | :--- |
| `pm2 status` | ดูรายการโปรเซสและสถานะของทุกระบบ |
| `pm2 logs keelek-backend` | ดู log การทำงานของ backend แบบ realtime |
| `pm2 restart keelek-backend` | สั่ง restart backend หลังแก้โค้ด |
| `docker ps` | ดูสถานะตู้คอนเทนเนอร์ฐานข้อมูล MySQL |
| `nginx -t` | ทดสอบความถูกต้องของไฟล์คอนฟิก Nginx |
| `systemctl reload nginx` | รีโหลด Nginx โดยไม่ต้องดับเซิร์ฟเวอร์ |
| `htop` | ตรวจสอบการใช้งาน CPU และ RAM ของเซิร์ฟเวอร์ |
| `df -h` | ตรวจสอบพื้นที่ฮาร์ดดิสก์ SSD ที่เหลือ |

