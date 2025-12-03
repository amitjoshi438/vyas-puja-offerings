# Data Folder Structure

This folder contains all offerings data organized by year for the Vyasa Puja website.

## Structure

```
data/
├── 2025/
│   └── offerings.json
├── 2026/
│   └── offerings.json
└── [future years]/
    └── offerings.json
```

## Adding Data for a New Year

1. Create a new folder with the year name (e.g., `2026`)
2. Add the offerings JSON file as `offerings.json` in that folder
3. Update the `CURRENT_YEAR` constant in `scripts/main.js` to point to the new year

## JSON File Format

Each `offerings.json` file should contain an array of offering objects with the following structure:

```json
[
  {
    "Your Name": "Disciple Name",
    "Name of City you are from": "City Name",
    "country": "Country Name",
    "Your Offering": "The offering text..."
  }
]
```

## Example

To switch to 2026 offerings:

1. Create folder: `data/2026/`
2. Add file: `data/2026/offerings.json`
3. In `scripts/main.js`, change:
   ```javascript
   const CURRENT_YEAR = 2026;
   ```

This structure allows the website to easily scale across multiple years while maintaining historical data.
