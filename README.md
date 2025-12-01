# 75th Vyasa Puja - HH Radhanath Swami Maharaj

A beautiful, traditional-themed tribute website displaying heartfelt offerings from disciples worldwide on the occasion of His Holiness Radhanath Swami Maharaj's 75th Appearance Day (2025).

## 🙏 Features

- **Beautiful Traditional Design**: Saffron and gold color palette with lotus decorations
- **Responsive Layout**: Works perfectly on desktop, tablet, and mobile devices
- **Advanced Search**: Real-time search across names, cities, and countries
- **Smart Filtering**: Filter offerings by country and city
- **Lazy Loading**: Efficient rendering of 10,000+ offerings
- **Interactive Modal**: Click any card to read the full offering with smooth animations
- **Statistics Dashboard**: Auto-counting statistics showing total offerings, countries, and cities
- **Keyboard Navigation**: Navigate through offerings using arrow keys in modal view

## 📁 Project Structure

```
vyasPujaSite/
├── index.html              # Homepage with hero section and statistics
├── offerings.html          # Offerings page with search and grid
├── csvjson.json           # Data file with all offerings
├── styles/
│   └── main.css           # All styling (traditional theme)
├── scripts/
│   └── main.js            # All JavaScript functionality
├── assets/
│   └── images/
│       └── maharaj-portrait.jpg  # Portrait image (add your own)
└── README.md              # This file
```

## 🚀 Quick Start

### Option 1: Open Locally

1. Simply open `index.html` in your web browser
2. No build process or dependencies required!

### Option 2: Local Server (Recommended)

Using Python:
```bash
# Python 3
python -m http.server 8000

# Then visit: http://localhost:8000
```

Using Node.js:
```bash
# Install serve globally
npm install -g serve

# Run server
serve

# Or use npx (no installation)
npx serve
```

## 🌐 Deployment Options

### GitHub Pages (Free & Easy)

1. **Create a GitHub repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Vyasa Puja website"
   ```

2. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/vyasa-puja-2025.git
   git branch -M main
   git push -u origin main
   ```

3. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: Deploy from branch `main`
   - Folder: `/ (root)`
   - Click Save
   - Your site will be live at: `https://YOUR-USERNAME.github.io/vyasa-puja-2025/`

### Netlify (Drag & Drop - No Git Required)

1. Go to [netlify.com](https://www.netlify.com/)
2. Sign up for free
3. Drag your entire `vyasPujaSite` folder onto the Netlify dashboard
4. Your site is live in seconds!
5. Optional: Add custom domain in Site Settings

### Vercel (Fast & Free)

1. Go to [vercel.com](https://vercel.com/)
2. Import your GitHub repository (or drag & drop folder)
3. Click Deploy
4. Done! Your site is live

## 🖼️ Adding Images

### Portrait Image

Replace the placeholder with Maharaj's portrait:

1. Add your image to `assets/images/maharaj-portrait.jpg`
2. Recommended size: 500x500px or larger (square format)
3. Supported formats: JPG, PNG, WebP

### Additional Images (Optional)

You can add more images for:
- Hero background: Update CSS in `.hero` section
- Gallery section: Create new section in HTML
- Decorative elements: Add to `assets/images/` folder

## 🎨 Customization

### Colors

Edit `styles/main.css` variables at the top:

```css
:root {
    --saffron: #FF9933;        /* Main saffron color */
    --deep-saffron: #FF6600;   /* Accent color */
    --gold: #FFD700;           /* Gold highlights */
    /* ... other colors */
}
```

### Fonts

Current fonts:
- **Poppins**: English text
- **Noto Sans Devanagari**: Hindi/Sanskrit text

To change fonts, update the Google Fonts link in HTML files.

### Content

- **Homepage text**: Edit `index.html` → `.hero-description` section
- **About section**: Edit `index.html` → `.about-section`
- **Footer**: Edit footer section in both HTML files

## 📊 Data Format

The `csvjson.json` file contains offerings in this format:

```json
[
  {
    "Your Name": "Disciple Name",
    "Name of City you are from": "City Name",
    "country": "(Country)",
    "Your Offering": "Full offering text..."
  }
]
```

### Updating Data

1. Edit `csvjson.json` directly, or
2. Replace with new export from Google Sheets/Excel:
   - Export as CSV
   - Convert to JSON using [csvjson.com](https://csvjson.com/)
   - Replace `csvjson.json` file

## 🔧 Technical Details

### Browser Support

- Chrome/Edge: ✅ Latest 2 versions
- Firefox: ✅ Latest 2 versions
- Safari: ✅ 13+
- Mobile browsers: ✅ iOS Safari, Chrome Mobile

### Performance

- **Lazy Loading**: Loads 50 cards at a time
- **Debounced Search**: 300ms delay for smooth searching
- **CSS Animations**: GPU-accelerated for smoothness
- **No Dependencies**: Pure vanilla JavaScript (no jQuery, React, etc.)

### Features Implementation

1. **Search**: Fuzzy search across all fields
2. **Filters**: Dropdown filters auto-populated from data
3. **Modal**: Keyboard navigation (Esc, Arrow keys)
4. **Infinite Scroll**: Auto-loads more as you scroll
5. **Statistics**: Animated counters on homepage

## 🐛 Troubleshooting

### Offerings not loading?

1. Check browser console for errors (F12)
2. Ensure `csvjson.json` is in the same folder as `index.html`
3. If using `file://` protocol, switch to local server (see Quick Start)

### Images not showing?

1. Verify image path: `assets/images/maharaj-portrait.jpg`
2. Check image file name matches exactly (case-sensitive)
3. Try using absolute path for testing

### Search not working?

1. Clear browser cache (Ctrl+Shift+R)
2. Check that JavaScript is enabled
3. Open console to see any error messages

## 📱 Mobile Optimization

The website is fully responsive:
- Touch-friendly card interactions
- Optimized font sizes for mobile
- Hamburger menu ready (if needed)
- Modal swipe support (via arrow buttons)

## 🙏 Credits

**Created with devotion for:**
His Holiness Radhanath Swami Maharaj's 75th Vyasa Puja

**Technology:**
- Pure HTML5, CSS3, JavaScript (ES6+)
- Google Fonts (Poppins, Noto Sans Devanagari)
- No external frameworks or libraries

**All Glories to Srila Prabhupada**  
**All Glories to HH Radhanath Swami Maharaj**

---

## 📞 Support

For technical issues or questions:
1. Check this README first
2. Review browser console for errors
3. Verify all files are in correct locations

## 🔜 Future Enhancements (Optional)

- [ ] Add year-wise filtering (if data includes multiple years)
- [ ] Download offerings as PDF
- [ ] Share individual offerings on social media
- [ ] Add world map showing disciple locations
- [ ] Audio player for kirtan/lecture clips
- [ ] Multi-language support
- [ ] Dark mode toggle

---

**Hare Krishna Hare Krishna Krishna Krishna Hare Hare**  
**Hare Rama Hare Rama Rama Rama Hare Hare**
