# 🌳 Aajonus.net - Markdown Website With Instant Full Text-Search

A brutally minimal, **fully self-hosted** knowledge base for text archives.

Drop `.md` / `.txt` files into a folder and you immediately get a **full-text search website**.  

**Live demo**: [https://aajonus.net](https://aajonus.net)

---

## Why this exists

Most “knowledge base” stacks are **heavy**:
databases, build steps, Node pipelines, third-party search, hosted analytics, and a pile of dependencies.

This repo is the opposite:

✅ **File-based** (your content is just files)  
✅ **Privacy first** (everything runs entirely on the user’s browser)  
✅ **Easy to maintain** (just PHP + vanilla JS)  
✅ **No dependencies** (no composer, no npm, no build steps)  
✅ **Fast UX** (Web Worker search + IndexedDB cache)  

---

## Features

- 🔍 **Instant full-text search** with context previews (exact & partial matches) - click result → auto-scrolls to the hit
- 📴 **Offline-first**: cached locally after first load
- 📝 **Markdown support**: all your notes render instantly
- 🗂️ **Folders become categories** (and subcategories)
- 📱 **Mobile-friendly UI**: fast, responsive, no bloat
- 🔗 **Shareable URLs** with highlighted matches
- 🧭 **SEO ready**: pretty URLs, auto sitemap.xml, link previews
- 🧩 **"Find on Page" overlay** (`findonpage.js`), works great on mobile
- 🕵️ **Zero third parties**: no database, no cloud, no trackers, no external fonts


<details markdown="1">
<summary><strong>👉 See also: Why this search is better than Apple Notes or Obsidian Publish</strong></summary>

### 1. **They only show the FIRST match per document**

When you search for “productivity,” most systems show you:

- Note A: “…boost your productivity by…” ✅ (shown)
- Note A: “…productivity hacks include…” ❌ (hidden)
- Note A: “…measuring productivity over time…” ❌ (hidden)

You see that Note A has your search term, but you have to **open the note and manually search again** to find all 3 instances. This is how Apple Notes, Obsidian Publish, and many others work.

**What you actually want:**  
See ALL matches at once, with context snippets for each occurrence.

### 2. **Exact phrase only (no flexible word matching)**

If you search for “honey butter,” most systems only find:

- “honey butter” ✅ (exact phrase found)

But they **won’t** find:

- “honey can be found together with butter” ❌
- “butter mixed with raw honey” ❌
- “I prefer honey over butter” ❌

The words exist in your notes, but because they’re not right next to each other, the search misses them entirely.

**What you actually want:**  
Find notes where BOTH words appear within a near range.

**This solution fixes both:**

- Shows **every match** with context snippets
- Supports **partial matching** out of the box

</details>

---
## 🛠️ Quick Setup (live in 3 minutes)

This guide assumes a fresh Ubuntu/Debian VPS.

### 1) Install Apache + PHP
```bash
sudo apt update
sudo apt install apache2 php libapache2-mod-php php-xml php-mbstring -y
```

### 2) Upload files

Copy all the repository files to your server at:

```bash
/var/www/html
```

Your content lives in:

```txt
texts/
```

Ensure the **file permissions** are set correctly so your browser can view them.

<details markdown="1">
<summary><strong>👉 Click to expand: How to set the file permissions</strong></summary>

#### Ensure proper permissions (Make files readable by your web server):

```bash
sudo chown -R www-data:www-data /var/www/html/
sudo find /var/www/html/ -type f -exec chmod 644 {} \;
sudo find /var/www/html/ -type d -exec chmod 755 {} \;
```
</details>

### 3) Enable `.htaccess` (pretty URLs, caching, etc.)

1. Edit `/etc/apache2/apache2.conf`:

Find the `<Directory /var/www/>` section and change:
```apache
<Directory /var/www/>
    Options Indexes FollowSymLinks
    AllowOverride All    # Change from None to All
    Require all granted
</Directory>
```

2. Enable required Apache modules:

```bash
sudo a2enmod rewrite headers expires
sudo systemctl reload apache2
```

### 4) Open the site

Visit your server IP or domain in a browser.

That’s it.

---

## 🌐 Go public

Once you have a domain name (i.e. yourdomain.com), do this.

### Enable HTTPS

```bash
sudo apt install certbot python3-certbot-apache -y
sudo certbot --apache -d yourdomain.com -d www.yourdomain.com
sudo systemctl restart apache2
```

### Basic Site SEO

Update `robots.txt`, `manifest.json`, and `config.php` with your domain/site details:

```php
$baseUrl = 'https://yourdomain.com/';
$logoTitle = "YourSite";
$siteTitle = "Your Site Title";
$siteDescription = "Short description...";
```

---

## ⚡ Performance & Security (Optional but recommended)

If you’re serving a big library or have high traffic, these will boost **performance & speed** massively.

<details markdown="1">
<summary><strong>👉 Click to expand: PHP 8.3 FPM, HTTP/2, Brotli, Fail2ban, etc</strong></summary>

### Performance: Install PHP-FPM & Enable HTTP/2, Brotli

```bash
sudo apt install php8.3-fpm php8.3-xml php8.3-mbstring -y
sudo systemctl enable --now php8.3-fpm

sudo a2dismod php8.3
sudo a2enmod proxy_fcgi
sudo a2enconf php8.3-fpm

sudo a2dismod mpm_prefork
sudo a2enmod mpm_event
sudo a2enmod http2

sudo systemctl restart apache2
```
**Enable Brotli compression (faster load)**

```bash
sudo a2enmod brotli
sudo systemctl restart apache2
```

### Performance: Increase PHP-FPM capacity

Edit `/etc/php/8.3/fpm/pool.d/www.conf`:

```ini
pm.max_children = 25
```

Apply changes:
```bash
sudo systemctl restart php8.3-fpm
```



---

### Security: Limit Log Size

Edit `/etc/systemd/journald.conf`:

Uncomment (remove the #) and set:
```ini
SystemMaxUse=200M
```

Apply changes:
```bash
sudo systemctl restart systemd-journald
```

### Security: Install Fail2ban (Prevent brute force attacks)

```bash
sudo apt install fail2ban -y
sudo systemctl enable --now fail2ban
```

### Security: Hide Apache Version

Edit `/etc/apache2/conf-available/security.conf`:

```apache
ServerSignature Off
ServerTokens Prod
```

Apply changes:
```bash
sudo systemctl restart apache2
```

</details>

---

## Folder Structure

```
/var/www/html/
├── index.php         # Main application file
├── config.php        # Site configuration
├── style.css         # Stylesheet
├── .htaccess         # Apache rewrite rules
├── code/
│   ├── Parsedown.php      # Markdown parser
│   ├── ParsedownExtra.php
│   ├── index.js           # Search & UI logic
│   ├── localsearch.js     # Search Web Worker
│   ├── findonpage.js      # Find-in-page tool
│   ├── findonpage.css
│   ├── loadsearch.php     # Content loader
│   └── sitemap.php        # Sitemap generator
├── logos/
│   ├── favicon.ico
│   ├── apple-touch-icon.png
│   └── large-logo.jpg
├── imgs/      # Linked Images (JPG, PNG, etc)
├── docs/      # Linked Documents (PDFs, etc)
├── texts/     # Your Markdown content folder
│   ├── Q&A/
│   ├── Newsletters/
│   ├── Books/
│   └── ...
├── manifest.json
└── robots.txt
```

---

## Content

### Supported file types

* `.md` (Markdown)
* `.txt` (plain text)

### Content Organization

Content is organized in the `texts/` folder:

- Each **folder** becomes a **category**
- Each **Markdown file** becomes an **article**
- Nested folders create subcategories
- File names become article titles

Example:
```
texts/
├── Q&A/
│   ├── Q&A Session 1.md
│   └── Q&A Session 2.md
├── Books/
│   ├── We Want to Live.md
│   └── The Recipe for Living Without Disease.md
└── Newsletters/
    └── Newsletter January 2010.md
```

### URL Structure

The site supports clean URLs through `.htaccess` rewrites:

- **Homepage**: `https://yoursite.com/`
- **Category**: `https://yoursite.com/category-name/`
- **Article**: `https://yoursite.com/article-slug`
- **With category**: `https://yoursite.com/category/article-slug` (if `$categoryInLinks = true`)

Example:

```txt
"My Article (Final).md" → /my-article-final
```

---

## Special Markdown Syntax

### Media

In your `.md` file:

```md
[audio]: (https://example.com/file.mp3)
[video]: (https://example.com/file.mp4)
```

### Images

Supported:

```markdown
# Standard Markdown
![Alt text](image.jpg)

# Obsidian-style (auto-prefixes /imgs/)
![[image.jpg]]

# With custom width
![[image.jpg | 500]]
```

---

## Troubleshooting

### 404 Errors / Clean URLs not working

1. Verify `.htaccess` exists in `/var/www/html/`
2. Confirm `AllowOverride All` in `/etc/apache2/apache2.conf`
3. Enable modules: `sudo a2enmod rewrite headers expires`
4. Restart Apache: `sudo systemctl restart apache2`

### Articles not showing or empty

1. Check file permissions (should be 644 for files, 755 for folders)
2. Verify `$mdFolder` path in `config.php`
3. Ensure files have `.md` or `.txt` extension
4. Check Apache error logs: `sudo tail -f /var/log/apache2/error.log`

### Search results look outdated

Article pages update instantly when you edit files in `texts/` (`.md` / `.txt`).  
The search dataset, however, is **cached for 24 hours** in the visitor’s browser (IndexedDB).

If search results are outdated, you can do this:
- **Wait up to 24h** (cache expires automatically), or
- Open the site in a **new private/incognito window**, or
- **Clear site data / IndexedDB** for your domain, or
- DevTools → **Application** → **IndexedDB** → delete the site DB (then reload)

### Search stuck on “Loading…”

1. Check that `/code/loadsearch.php` is reachable and loading.
2. Check for broken files in `texts/` (binary junk, insanely large file, or non-UTF-8 / invalid bytes).
3. Check Apache error logs: `sudo tail -n 200 /var/log/apache2/error.log`

---

## Privacy / No third parties

- No analytics, no trackers, no cookies by default
- No external fonts, CDNs, or JS libraries at runtime
- Search runs locally in the browser (Web Worker) and is cached only on the user’s device

---

## License

MIT License. Free to use, modify, and distribute.

---

## Credits

* Parsedown / ParsedownExtra for Markdown rendering (included locally)