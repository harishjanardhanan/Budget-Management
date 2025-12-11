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

# Install Node.js 22 (LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node.js installation
node --version  # Should show v22.x.x
npm --version

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Verify PostgreSQL installation
sudo systemctl status postgresql

# Install Docker (optional, for containerized deployment)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo apt install -y docker-compose

# IMPORTANT: Log out and log back in for Docker group to take effect
# Or run: newgrp docker

# Verify Docker installation
docker --version
docker-compose --version

# Install Nginx (for reverse proxy)
sudo apt install -y nginx

# Verify Nginx installation
nginx -v
sudo systemctl status nginx

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

### Configure PostgreSQL Authentication

PostgreSQL needs to be configured to accept password authentication:

```bash
# Edit PostgreSQL configuration
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Find the line that looks like:
# local   all             all                                     peer
# 
# Add this line BEFORE the peer authentication line:
# local   all             budget_user                             md5

# Or change the peer line to:
# local   all             all                                     md5
```

**Quick method** (adds password authentication for budget_user):

```bash
# Add password authentication for budget_user
echo "local   all             budget_user                             md5" | sudo tee -a /etc/postgresql/14/main/pg_hba.conf

# Restart PostgreSQL to apply changes
sudo systemctl restart postgresql

# Verify PostgreSQL is running
sudo systemctl status postgresql
```

### Verify Database Connection

```bash
# Test connection with the budget_user
psql -U budget_user -d budget_app -h localhost

# If prompted for password, enter the password you set above
# If successful, you'll see the PostgreSQL prompt
# Type \q to exit
```

## Step 7: Deploy Application

### First: Upload Your Code to the Instance

You need to transfer your application files from your local machine to the Oracle Cloud instance. Choose one of these methods:

> [!IMPORTANT]
> **Before uploading, ensure your SSH key has correct permissions:**
> ```bash
> chmod 600 /path/to/your-ssh-key
> # Example: chmod 600 ~/.ssh/id_rsa
> ```
> If you see "Permission denied" errors, this is usually the cause.

#### Method 1: Using SCP (Secure Copy)

From your **local machine** (not the remote instance), run:

**Option 1a: Simple SCP (uploads everything including node_modules)**

```bash
# Navigate to the parent directory of your project
cd /path/to/your/projects

# Upload the entire budgetmanagement folder
scp -i /path/to/your-ssh-key -r budgetmanagement ubuntu@YOUR_PUBLIC_IP:/home/ubuntu/

# Example:
# scp -i ~/.ssh/oracle-cloud-key -r budgetmanagement ubuntu@123.45.67.89:/home/ubuntu/
```

**Option 1b: Using rsync (RECOMMENDED - excludes node_modules and .git)**

```bash
# Navigate to the parent directory of your project
cd /path/to/your/projects

# Upload with exclusions (faster and cleaner)
rsync -avz -e "ssh -i /path/to/your-ssh-key" \
  --exclude='node_modules' \
  --exclude='.git' \
  budgetmanagement ubuntu@YOUR_PUBLIC_IP:/home/ubuntu/

# Example:
# rsync -avz -e "ssh -i ~/.ssh/oracle-cloud-key" --exclude='node_modules' --exclude='.git' budgetmanagement ubuntu@123.45.67.89:/home/ubuntu/
```

**Option 1c: Using tar + scp (RECOMMENDED - excludes node_modules and .git)**

> [!TIP]
> This method is recommended because it avoids uploading `node_modules`, which prevents binary compatibility issues with native modules like bcrypt.

```bash
# Navigate to the parent directory of your project
cd /path/to/your/projects

# Create a tarball excluding node_modules and .git
tar --exclude='node_modules' --exclude='.git' -czf budgetmanagement.tar.gz budgetmanagement

# Upload the tarball
scp -i /path/to/your-ssh-key budgetmanagement.tar.gz ubuntu@YOUR_PUBLIC_IP:/home/ubuntu/

# SSH into the instance and extract
ssh -i /path/to/your-ssh-key ubuntu@YOUR_PUBLIC_IP
cd /home/ubuntu
tar -xzf budgetmanagement.tar.gz
rm budgetmanagement.tar.gz

# Verify extraction
ls -la budgetmanagement/
```

#### Method 2: Using Git (If your code is in a repository)

SSH into your instance first, then:

```bash
cd /home/ubuntu
git clone https://github.com/yourusername/budgetmanagement.git
# Or if using SSH: git clone git@github.com:yourusername/budgetmanagement.git
```

#### Method 3: Using SFTP (GUI option)

Use an SFTP client like:
- **FileZilla** (Windows/Mac/Linux)
- **Cyberduck** (Mac)
- **WinSCP** (Windows)

Connection details:
- Host: `YOUR_PUBLIC_IP`
- Protocol: SFTP
- Port: 22
- Username: `ubuntu`
- Key file: Your SSH private key

Then drag and drop the `budgetmanagement` folder to `/home/ubuntu/`

---

### Option A: Direct Deployment (Recommended for beginners)

After uploading your code using one of the methods above:

```bash
# SSH into your instance (if not already connected)
ssh -i /path/to/your-ssh-key ubuntu@YOUR_PUBLIC_IP

# Navigate to the app directory
cd /home/ubuntu/budgetmanagement

# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..

# Install server dependencies (fresh install ensures Linux-compatible binaries)
cd server
npm install
cd ..
```

> [!IMPORTANT]
> If you uploaded `node_modules` from your local machine, you MUST delete them first:
> ```bash
> rm -rf /home/ubuntu/budgetmanagement/node_modules
> rm -rf /home/ubuntu/budgetmanagement/server/node_modules
> rm -rf /home/ubuntu/budgetmanagement/client/node_modules
> # Then run npm install commands above
> ```

### Configure Environment Variables

```bash
# Create .env file from example
cp .env.example .env

# Edit the .env file
nano .env
```

Update the `.env` file with your production values:

> [!NOTE]
> Use the **same database password** you created in **Step 6** when you set up PostgreSQL.

```bash
# Database Configuration
# Use the password you set in Step 6 for budget_user
DATABASE_URL=postgresql://budget_user:your_secure_password_here@localhost:5432/budget_app

# JWT Secret (generate a random string for production)
# You can generate one with: openssl rand -base64 32
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Server Configuration
PORT=3001
NODE_ENV=production

# Frontend URL (use your domain or IP)
FRONTEND_URL=http://YOUR_PUBLIC_IP
# Or if you have a domain: FRONTEND_URL=https://your-domain.com
```

**Example with actual values:**
```bash
# If in Step 6 you created budget_user with password "MySecurePass123!"
# and your instance IP is 123.45.67.89, your .env would look like:

DATABASE_URL=postgresql://budget_user:MySecurePass123!@localhost:5432/budget_app
JWT_SECRET=xK9mP2vN8qR5tY7wZ3bC6fH1jL4nM0pS  # Generated with openssl rand -base64 32
PORT=3001
NODE_ENV=production
FRONTEND_URL=http://123.45.67.89
```

**Generate a secure JWT secret:**

```bash
# Generate a random JWT secret
openssl rand -base64 32

# Copy the output and paste it as your JWT_SECRET in .env
```

### Initialize Database Schema

The application will automatically create the database tables when the server starts for the first time. However, you can verify this:

```bash
# Start the server temporarily to initialize the database
cd /home/ubuntu/budgetmanagement/server
node index.js

# You should see:
# ✅ Database connected successfully
# ✅ Database schema initialized successfully
# Server running on port 3001

# Press Ctrl+C to stop the server
```

### Set Up Process Manager (PM2)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start backend with PM2
cd /home/ubuntu/budgetmanagement/server
pm2 start index.js --name budget-api

# Verify it's running
pm2 status

# Check logs to ensure no errors
pm2 logs budget-api --lines 50
```

### Build Frontend

```bash
# Build the React frontend
cd /home/ubuntu/budgetmanagement/client
npm run build

# Verify build was successful
ls -la dist/

# You should see index.html and assets folder
```

### Verify Installation

```bash
# Check PM2 status
pm2 status
# Should show budget-api as "online"

# Check backend logs
pm2 logs budget-api --lines 20
# Should show "Server running on port 3001"

# Test backend is responding
curl http://localhost:3001/api/health || echo "Health endpoint may not exist"

# Verify frontend build exists
ls -la /home/ubuntu/budgetmanagement/client/dist/index.html

# Check database tables were created
psql -U budget_user -d budget_app -h localhost -c "\dt"
# Should list: users, categories, transactions, budgets, recurring_transactions
```

Continue to **Step 8** to configure Nginx.

### Option B: Docker Deployment

> [!WARNING]
> If you already started the app using **Option A (Direct Deployment)**, you must stop it first to avoid port conflicts:
> ```bash
> pm2 stop budget-api
> pm2 delete budget-api
> # Or if running directly: sudo lsof -ti:3001 | xargs sudo kill -9
> ```

```bash
# SSH into your instance (if not already connected)
ssh -i /path/to/your-ssh-key ubuntu@YOUR_PUBLIC_IP

# Navigate to the app directory
cd /home/ubuntu/budgetmanagement

# Create production .env with required variables
cat > .env << 'EOF'
DB_PASSWORD=password
JWT_SECRET=your-generated-jwt-secret-here
EOF

# IMPORTANT: Use 'docker compose' (no hyphen) - it's the modern command
# Stop any existing containers
docker compose -f docker-compose.prod.yml down

# Build and run
docker compose -f docker-compose.prod.yml up -d --build
```

**If you get nginx.conf error**, use this simplified configuration without nginx:

```bash
# Create simplified docker-compose without nginx
cat > docker-compose-simple.yml << 'EOF'
version: '3.8'

services:
  app:
    build: .
    container_name: budget-app
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://budget_user:${DB_PASSWORD:-password}@db:5432/budget_app
      - JWT_SECRET=${JWT_SECRET:-change-this-secret}
      - NODE_ENV=production
      - PORT=3001
    depends_on:
      - db
    networks:
      - budget-network

  db:
    image: postgres:16-alpine
    container_name: budget-db
    restart: unless-stopped
    environment:
      - POSTGRES_USER=budget_user
      - POSTGRES_PASSWORD=${DB_PASSWORD:-password}
      - POSTGRES_DB=budget_app
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - budget-network

volumes:
  postgres-data:

networks:
  budget-network:
    driver: bridge
EOF

# Run with simplified compose file
docker compose -f docker-compose-simple.yml up -d --build

# Check status
docker compose -f docker-compose-simple.yml ps

# View logs
docker compose -f docker-compose-simple.yml logs -f
```

**Access your app**: `http://YOUR_PUBLIC_IP:3001`

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
        root /home/ubuntu/budgetmanagement/client/dist;
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

## Step 9: Set Up SSL (HTTPS) - Optional

> [!NOTE]
> **This step is ONLY needed if you have a domain name.** If you're using just the public IP address, skip this step and access your app via `http://YOUR_PUBLIC_IP`.

If you have a domain name:

```bash
sudo certbot --nginx -d your-domain.com
```

Follow the prompts. Certbot will automatically configure SSL and set up auto-renewal.

**Without a domain**: Your app will be accessible at `http://YOUR_PUBLIC_IP` (not HTTPS). This is fine for testing and personal use.

## Step 10: Configure Firewall on VM

```bash
# Allow necessary ports
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Step 11: Set Up Auto-Start (Option A Only)

> [!NOTE]
> **This step is ONLY for Option A (Direct Deployment).** If you used Docker (Option B), skip this step - Docker containers already auto-restart with the `restart: unless-stopped` policy.

For **Option A (Direct Deployment)** only:

```bash
# Make PM2 start on boot
pm2 startup
# Copy and run the command that PM2 outputs
pm2 save

# Enable Nginx on boot
sudo systemctl enable nginx

# Enable PostgreSQL on boot
sudo systemctl enable postgresql
```

For **Option B (Docker Deployment)**, ensure Docker starts on boot:

```bash
# Enable Docker service to start on boot
sudo systemctl enable docker

# Verify it's enabled
sudo systemctl is-enabled docker

# Your containers will auto-start because of "restart: unless-stopped" in docker-compose
```

## Accessing Your App

**With domain name (after SSL setup)**:
- https://your-domain.com

**Without domain name (using public IP)**:
- http://YOUR_PUBLIC_IP

**For Docker deployment**:
- http://YOUR_PUBLIC_IP:3001 (if using docker-compose-simple.yml)

Replace `YOUR_PUBLIC_IP` with your Oracle Cloud instance's actual public IP address.

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
cd /home/ubuntu/budgetmanagement
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

### File Upload Issues

#### SSH Permission Denied
```bash
# Error: "Permission denied" or "exec on '/path/to/key': Permission denied"

# Fix: Set correct permissions on SSH key
chmod 600 /path/to/your-ssh-key

# Verify permissions
ls -la /path/to/your-ssh-key
# Should show: -rw------- (600)

# If using default key:
chmod 600 ~/.ssh/id_rsa
```

#### Can't Connect to Instance
```bash
# Error: "Connection refused" or "Connection timed out"

# 1. Verify instance is running in Oracle Cloud Console
# 2. Check you're using the correct public IP
# 3. Verify security list allows SSH (port 22)
# 4. Test SSH connection first:
ssh -i /path/to/your-ssh-key ubuntu@YOUR_PUBLIC_IP

# If SSH works but rsync doesn't, use tar+scp method instead
```

#### rsync Not Found or Errors
```bash
# If rsync gives errors, use the tar+scp method instead:

cd /Users/harish/Developer/workspace
tar --exclude='node_modules' --exclude='.git' -czf budgetmanagement.tar.gz budgetmanagement
scp -i /path/to/your-ssh-key budgetmanagement.tar.gz ubuntu@YOUR_PUBLIC_IP:/home/ubuntu/

# Then SSH in and extract:
ssh -i /path/to/your-ssh-key ubuntu@YOUR_PUBLIC_IP
cd /home/ubuntu
tar -xzf budgetmanagement.tar.gz
rm budgetmanagement.tar.gz
```

### Can't connect to app
- Check firewall rules in Oracle Cloud Console
- Check UFW: `sudo ufw status`
- Check Nginx: `sudo nginx -t && sudo systemctl status nginx`
- Check backend: `pm2 status`

### Database connection errors
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify credentials in `.env`
- Check database exists: `sudo -u postgres psql -l`
- Verify pg_hba.conf has password authentication enabled
- Test connection: `psql -U budget_user -d budget_app -h localhost`

### Database tables not created
```bash
# Check if tables exist
psql -U budget_user -d budget_app -h localhost -c "\dt"

# If no tables, check server logs
pm2 logs budget-api --lines 100

# Manually trigger initialization by restarting the server
pm2 restart budget-api
pm2 logs budget-api --lines 50

# Look for "✅ Database schema initialized successfully"
```

### PM2 process crashes immediately
```bash
# Check detailed error logs
pm2 logs budget-api --err --lines 100

# Common issues:
# 1. Database connection failed - check DATABASE_URL in .env
# 2. Port already in use - check: sudo lsof -i :3001
# 3. Missing dependencies - run: npm install in server directory
# 4. Syntax errors - check Node.js version: node --version (should be 22.x)

# Try running directly to see errors
cd /home/ubuntu/budgetmanagement/server
node index.js
```

### bcrypt or native module errors
```bash
# Error: "invalid ELF header" or "MODULE_NOT_FOUND" for bcrypt
# This happens when node_modules were copied from a different OS (macOS/Windows to Linux)

# Solution: Remove node_modules and reinstall fresh on Linux
cd /home/ubuntu/budgetmanagement/server
rm -rf node_modules
npm install

# Verify it works
node index.js

# If you see the error in other directories, clean those too:
cd /home/ubuntu/budgetmanagement
rm -rf node_modules client/node_modules server/node_modules
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..
```

### Frontend shows blank page
```bash
# Verify build exists
ls -la /home/ubuntu/budgetmanagement/client/dist/

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify Nginx configuration
sudo nginx -t

# Check browser console for errors (F12)
# Common issue: API calls failing due to CORS or wrong FRONTEND_URL

# Rebuild frontend
cd /home/ubuntu/budgetmanagement/client
npm run build
sudo systemctl restart nginx
```

### SSL issues
- Ensure domain DNS points to your IP
- Run: `sudo certbot renew --dry-run`

### Docker Issues

#### Container name conflicts
```bash
# Error: "container name is already in use"

# Stop and remove all containers
docker compose -f docker-compose.prod.yml down
# or: docker compose -f docker-compose-simple.yml down

# Remove orphaned containers
docker container prune -f

# Start fresh
docker compose -f docker-compose-simple.yml up -d --build
```

#### nginx.conf not found
```bash
# Error: "nginx.conf: not a directory" or "no such file"

# Solution: Use the simplified docker-compose without nginx
# See Option B section for docker-compose-simple.yml

# Or create nginx.conf if you need it
# (Advanced users only - requires nginx configuration knowledge)
```

#### docker-compose version issues
```bash
# If using old docker-compose (1.x), update to docker compose v2

# Use modern command (no hyphen)
docker compose version

# If command not found, install Docker Compose v2
sudo apt update
sudo apt install docker-compose-plugin

# Then use: docker compose (not docker-compose)
```

#### View Docker logs
```bash
# View all logs
docker compose -f docker-compose-simple.yml logs

# Follow logs in real-time
docker compose -f docker-compose-simple.yml logs -f

# View specific service logs
docker compose -f docker-compose-simple.yml logs app
docker compose -f docker-compose-simple.yml logs db
```

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
