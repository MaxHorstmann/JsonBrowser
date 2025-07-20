# Json Browser

A Vue.js application that uses vue-good-table to display and manipulate JSON data in a beautiful, feature-rich table format.

## Features

- 📊 **Interactive Data Tables** - Powered by vue-good-table
- 🔍 **Search & Filter** - Built-in search functionality
- 📄 **Pagination** - Handle large datasets efficiently
- 🔄 **Sorting** - Multi-column sorting support
- ✏️ **CRUD Operations** - Edit and delete table rows
- 📝 **JSON Input** - Load custom JSON data dynamically
- 📱 **Responsive Design** - Works on all screen sizes

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:3000`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Usage

### Default Data
The app comes with sample data to demonstrate the table functionality.

### Loading Custom JSON Data
1. Click on the "Add JSON Data" section
2. Enter a JSON array in the textarea (example format below)
3. Click "Load JSON Data" to populate the table

### Example JSON Format
```json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "age": 30,
    "status": "Active"
  },
  {
    "id": 2,
    "name": "Jane Smith",
    "email": "jane@example.com",
    "age": 25,
    "status": "Active"
  }
]
```

## Table Features

- **Search**: Use the search box to filter table data
- **Sorting**: Click column headers to sort (supports multi-column sorting)
- **Pagination**: Navigate through pages using the pagination controls
- **Actions**: Use Edit/Delete buttons for row operations

## Built With

- [Vue.js 3](https://vuejs.org/) - Progressive JavaScript framework
- [vue-good-table](https://github.com/xaksis/vue-good-table) - Feature-rich data table component
- [Vite](https://vitejs.dev/) - Fast build tool and development server

## Project Structure

```
src/
├── index.html          # Main HTML template
├── main.js            # Application entry point
├── App.vue            # Main Vue component
├── package.json       # Dependencies and scripts
├── vite.config.js     # Vite configuration
└── README.md          # This file
```

## Customization

### Adding New Columns
Modify the `columns` array in `App.vue` to add new column definitions:

```javascript
{
  label: 'Column Name',
  field: 'fieldName',
  type: 'string', // or 'number', 'date', etc.
  width: '100px'  // optional
}
```

### Styling
- Modify the `<style>` section in `App.vue` for custom styling
- vue-good-table classes can be customized for theme changes

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).
