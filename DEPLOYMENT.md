# Deployment Guide - Oracle Cloud Always Free Tier

This guide will help you deploy the Family Budget Manager app to Oracle Cloud's Always Free Tier.

## Prerequisites

- Oracle Cloud account (free tier)
- Domain name (optional, but recommended)
- Basic command line knowledge

## Step 1: Create Oracle Cloud Account

1. Go to [oracle.com/cloud/free](https://www.oracle.com/cloud/free/)
2. Sign up for a free account
3. Verify your email and complete setup
4. Note: Credit card required for verification, but won't be charged

## Step 2: Create Compute Instance (VM)

1. Log in to Oracle Cloud Console
2. Navigate to **Compute** → **Instances**
3. Click **Create Instance**
4. Configure:
   - **Name**: budget-app-vm
   - **Image**: Ubuntu 22.04 (Always Free eligible)
   - **Shape**: VM.Standard.E2.1.Micro (Always Free)
   - **Network**: Create new VCN or use existing
   - **SSH Keys**: Generate or upload your SSH key
5. Click **Create**
6. Wait for instance to provision (2-3 minutes)
7. Note the **Public IP Address**

## Step 3: Configure Firewall Rules

1. In the instance details, click on the **Subnet** link
2. Click on the **Default Security List**
3. Click **Add Ingress Rules**
4. Add these rules:

**Rule 1 - HTTP**:
- Source CIDR: `0.0.0.0/0`
- Destination Port: `80`

**Rule 2 - HTTPS**:
- Source CIDR: `0.0.0.0/0`
- Destination Port: `443`

**Rule 3 - App (optional for testing)**:
- Source CIDR: `0.0.0.0/0`
- Destination Port: `3001`

## Step 4: SSH into Your Instance

```bash
ssh -i /path/to/your-ssh-key ubuntu@YOUR_PUBLIC_IP
```

## Step 5: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Docker (optional, for containerized deployment)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo apt install -y docker-compose

# Install Nginx (for reverse proxy)
sudo apt install -y nginx

# Install Certbot (for SSL)
sudo apt install -y certbot python3-certbot-nginx
```

## Step 6: Set Up PostgreSQL Database

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt:
CREATE DATABASE budget_app;
CREATE USER budget_user WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE budget_app TO budget_user;
\q
```

## Step 7: Deploy Application

### Option A: Direct Deployment (Recommended for beginners)

```bash
# Clone or upload your code
cd /home/ubuntu
# Upload your budget-app folder via scp or git

# Install dependencies
cd budget-app
npm install

# Set up environment
cp .env.example .env
nano .env
# Update DATABASE_URL with your PostgreSQL credentials
# Update JWT_SECRET with a random secure string

# Start database
npm run db:setup

# Install PM2 for process management
sudo npm install -g pm2

# Start backend
cd server
pm2 start index.js --name budget-api

# Build frontend
cd ../client
npm run build

# Serve frontend with Nginx (see Step 8)
```

### Option B: Docker Deployment

```bash
# Upload your code
cd /home/ubuntu/budget-app

# Create production .env
cp .env.example .env
nano .env
# Update with production values

# Build and run with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

## Step 8: Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/budget-app
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # or use your IP

    # Frontend
    location / {
        root /home/ubuntu/budget-app/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/budget-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 9: Set Up SSL (HTTPS)

If you have a domain name:

```bash
sudo certbot --nginx -d your-domain.com
```

Follow the prompts. Certbot will automatically configure SSL and set up auto-renewal.

## Step 10: Configure Firewall on VM

```bash
# Allow necessary ports
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Step 11: Set Up Auto-Start

```bash
# Make PM2 start on boot
pm2 startup
pm2 save

# Enable Nginx on boot
sudo systemctl enable nginx

# Enable PostgreSQL on boot
sudo systemctl enable postgresql
```

## Accessing Your App

- **With domain**: https://your-domain.com
- **With IP**: http://YOUR_PUBLIC_IP

## Maintenance

### View Logs
```bash
pm2 logs budget-api
sudo journalctl -u nginx
```

### Restart Services
```bash
pm2 restart budget-api
sudo systemctl restart nginx
```

### Update Application
```bash
cd /home/ubuntu/budget-app
git pull  # or upload new files
npm install
cd client && npm run build
pm2 restart budget-api
```

### Backup Database
```bash
pg_dump -U budget_user budget_app > backup_$(date +%Y%m%d).sql
```

## Troubleshooting

### Can't connect to app
- Check firewall rules in Oracle Cloud Console
- Check UFW: `sudo ufw status`
- Check Nginx: `sudo nginx -t && sudo systemctl status nginx`
- Check backend: `pm2 status`

### Database connection errors
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify credentials in `.env`
- Check database exists: `sudo -u postgres psql -l`

### SSL issues
- Ensure domain DNS points to your IP
- Run: `sudo certbot renew --dry-run`

## Cost Optimization

Oracle Cloud Always Free Tier includes:
- 2 VMs (we're using 1)
- 200 GB block storage
- 10 GB object storage
- Always free - no expiration!

**Important**: Stay within free tier limits to avoid charges. Monitor usage in Oracle Cloud Console.

## Security Best Practices

1. **Change default passwords** in `.env`
2. **Use strong JWT secret** (random 32+ characters)
3. **Keep system updated**: `sudo apt update && sudo apt upgrade`
4. **Enable automatic security updates**
5. **Regular backups** of database
6. **Monitor logs** for suspicious activity

## Next Steps

- Set up automatic database backups
- Configure monitoring (optional)
- Set up email notifications (optional)
- Add custom domain
- Configure CDN (optional, for better performance)

---

**Need Help?** Check Oracle Cloud documentation or community forums.
