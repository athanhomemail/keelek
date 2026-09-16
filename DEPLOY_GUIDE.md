# คู่มือการติดตั้งและ Deploy ระบบ Kee-Lek บน Cloud VPS (Ubuntu 22.04)

### ข้อมูลเครื่องเซิร์ฟเวอร์
- **IP Server**: `143.14.9.30`
- **OS**: Ubuntu 22.04 LTS (x86_64)
- **Domain หลัก**: `kuayrai.com` / `keelek.kuayrai.com`

---

## ขั้นตอนที่ 1: ชี้ Domain Name (DNS A Record)
ให้ล็อกอินเข้าไปที่เว็บผู้ให้บริการโดเมน (เช่น Cloudflare, GoDaddy หรือช่องทางที่ซื้อโดเมนไว้) แล้วเพิ่ม **DNS Record**:
* **Type**: `A` | **Name**: `@` | **Value**: `143.14.9.30` (สำหรับ `kuayrai.com`)
* **Type**: `A` | **Name**: `keelek` | **Value**: `143.14.9.30` (สำหรับ `keelek.kuayrai.com`)
* **Type**: `A` | **Name**: `*` | **Value**: `143.14.9.30` (เผื่อไว้สำหรับ Subdomain ในอนาคต เช่น `system1`)

---

## ขั้นตอนที่ 2: เชื่อมต่อ SSH เข้าเครื่อง VPS จากเครื่อง Mac
เปิด Terminal บน Mac แล้วพิมพ์คำสั่ง:
```bash
ssh root@143.14.9.30
```
*(ใส่รหัสผ่าน root ที่ผู้ให้บริการ VPS ส่งให้ทางอีเมล)*

---

## ขั้นตอนที่ 3: อัปเดตระบบและติดตั้งโปรแกรมพื้นฐาน
รันคำสั่งต่อไปนี้บน VPS:
```bash
# 1. อัปเดตแพ็กเกจ
apt update && apt upgrade -y

# 2. ติดตั้งโปรแกรมจำเป็น (git, curl, ufw, nginx, certbot)
apt install -y git curl ufw nginx certbot python3-certbot-nginx

# 3. ติดตั้ง Node.js 20 LTS และ PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

# 4. ติดตั้ง Docker & Docker Compose
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin
```

---

## ขั้นตอนที่ 4: นำโค้ดขึ้น Server VPS
บน VPS ให้สร้างโฟลเดอร์สำหรับเก็บโปรเจกต์:
```bash
mkdir -p /var/www/keelek
cd /var/www/keelek
```

**วิธีนำโค้ดขึ้น (เลือกอย่างใดอย่างหนึ่ง):**
* **วิธี A (แนะนำ - ผ่าน Git):**
  ```bash
  # ถ้าโค้ดอยู่บน GitHub หรือ GitLab
  git clone <URL_GIT_REPO> /var/www/keelek
  ```
* **วิธี B (ส่งไฟล์ตรงจาก Mac ด้วย rsync):**
  เปิด Terminal แท็บใหม่บน Mac แล้วรันคำสั่ง:
  ```bash
  rsync -avz --exclude 'node_modules' --exclude 'dist' /Users/torz.athan/@Projects/Kuayrai/keelek/ root@143.14.9.30:/var/www/keelek/
  ```

---

## ขั้นตอนที่ 5: เริ่มต้นฐานข้อมูล MySQL ด้วย Docker
บน VPS เข้าไปที่โฟลเดอร์ Docker ของโปรเจกต์:
```bash
cd /var/www/keelek/Docker
docker compose up -d
```
*ตรวจเช็คว่าคอนเทนเนอร์ทำงานเรียบร้อย:*
```bash
docker ps
# จะเห็น mysql-kuayrai รันอยู่ที่พอร์ต 3306
```

---

## ขั้นตอนที่ 6: ตั้งค่าและรัน Backend ด้วย PM2
```bash
cd /var/www/keelek/backend

# สร้างไฟล์ .env หากยังไม่มี
cp .env.example .env

# ติดตั้ง dependencies
npm install --production=false

# ถอยกลับมาที่ root เพื่อสั่งเริ่ม PM2 ด้วยไฟล์ ecosystem
cd /var/www/keelek
pm2 start ecosystem.config.cjs

# สั่งให้ PM2 จำการตั้งค่าและรันอัตโนมัติเมื่อ Server Restart
pm2 save
pm2 startup
# (คัดลอกคำสั่งที่ PM2 แนะนำมาวางแล้วรันอีกครั้งถ้ามี)
```
*เช็คสถานะ Backend:*
```bash
pm2 status
pm2 logs keelek-backend
```

---

## ขั้นตอนที่ 7: Build Frontend (Vite)
```bash
cd /var/www/keelek/frontend
npm install
npm run build
```
*(ระบบจะสร้างโฟลเดอร์ `/var/www/keelek/frontend/dist` ขึ้นมา)*

---

## ขั้นตอนที่ 8: ตั้งค่า Nginx Reverse Proxy
คัดลอกไฟล์ตั้งค่า Nginx เข้าสู่ระบบ:
```bash
cp /var/www/keelek/nginx-keelek.conf /etc/nginx/sites-available/keelek.kuayrai.com

# สร้าง Symbolic Link ไปที่ sites-enabled
ln -s /etc/nginx/sites-available/keelek.kuayrai.com /etc/nginx/sites-enabled/

# ลบ default site ออกเพื่อไม่ให้ชนกัน
rm -f /etc/nginx/sites-enabled/default

# ทดสอบไวยากรณ์ Nginx
nginx -t

# รีโหลด Nginx
systemctl reload nginx
```

---

## ขั้นตอนที่ 9: ติดตั้ง SSL Certificate ฟรี (HTTPS) ด้วย Certbot
เมื่อ DNS ชี้มาที่ IP เครื่องแล้ว ให้รันคำสั่ง:
```bash
certbot --nginx -d keelek.kuayrai.com -d kuayrai.com -d www.kuayrai.com
```
*กรอกอีเมล แล้วตอบ `Y` ยอมรับเงื่อนไข Certbot จะติดตั้ง SSL ให้อัตโนมัติและตั้งค่า HTTPS ให้อัตโนมัติทันที*

---

## การเพิ่มระบบอื่นๆ ในอนาคต (Multi-System Architecture)
เมื่อคุณต้องการเพิ่มระบบใหม่ เช่น `system1.kuayrai.com` หรือ `system2.twiniiz.com`:
1. **ฐานข้อมูล**:
   - สำหรับโดเมน `kuayrai.com`: เพิ่มฐานข้อมูลใหม่ลงใน `mysql-kuayrai` ได้เลย
   - สำหรับโดเมน `twiniiz.com`: สร้าง Docker compose ใหม่ชื่อคอนเทนเนอร์ `mysql-twiniiz` รันคนละพอร์ต (เช่น 3307)
2. **Backend**:
   - ให้ระบบใหม่รันพอร์ตถัดไป (เช่น 3001, 3002)
   - เพิ่มบล็อกคอนฟิกใน `ecosystem.config.cjs`
3. **Nginx**:
   - เพิ่มไฟล์คอนฟิกใหม่ใน `/etc/nginx/sites-available/system1.kuayrai.com`
   - ชี้ proxy ไปที่พอร์ต 3001
   - รัน `certbot --nginx -d system1.kuayrai.com`
