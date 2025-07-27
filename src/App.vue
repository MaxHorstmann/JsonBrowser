<template>
  <div id="app">
    <header class="app-header">
      <h1>Json Browser</h1>
      <p>A Vue.js application with vue-good-table for displaying JSON data</p>
    </header>

    <main class="main-content">
      <div class="table-container">
        <h2>Sample Data Table</h2>
        
        <!-- Vue Good Table Component -->
        <vue-good-table
          :columns="columns"
          :rows="rows"
          :pagination-options="{
            enabled: true,
            mode: 'records',
            perPage: 10,
            perPageDropdown: [10, 20, 50, 100],
            dropdownAllowAll: true,
          }"
          :search-options="{
            enabled: true,
            trigger: 'keyup'
          }"
          :sort-options="{
            enabled: true,
            multipleColumns: true
          }"
          styleClass="vgt-table striped bordered"
        >
        </vue-good-table>
      </div>

      <!-- JSON Input Section -->
      <div class="json-input-section">
        <h3>Add JSON Data</h3>
        <textarea
          v-model="jsonInput"
          placeholder="Enter JSON array or URL to JSON endpoint..."
          rows="6"
          class="json-textarea"
        ></textarea>
        <div class="auth-section">
          <label for="bearerToken" class="token-label">Bearer Token (optional):</label>
          <input
            id="bearerToken"
            v-model="bearerToken"
            type="password"
            placeholder="Enter bearer token for authenticated requests..."
            class="token-input"
          />
        </div>
        <div class="button-group">
          <button @click="loadJsonData" class="btn btn-primary" :disabled="isLoading">
            {{ isLoading ? 'Loading...' : 'Load JSON Data' }}
          </button>
          <button @click="clearData" class="btn btn-secondary">
            Clear Data
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      jsonInput: '',
      bearerToken: '',
      isLoading: false,
      columns: [
        {
          label: 'ID',
          field: 'id',
          type: 'number',
          width: '80px'
        },
        {
          label: 'Name',
          field: 'name',
          type: 'string'
        },
        {
          label: 'Email',
          field: 'email',
          type: 'string'
        },
        {
          label: 'Age',
          field: 'age',
          type: 'number',
          width: '80px'
        },
        {
          label: 'Status',
          field: 'status',
          type: 'string',
          width: '100px'
        }
      ],
      rows: [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          age: 30,
          status: 'Active'
        },
        {
          id: 2,
          name: 'Jane Smith',
          email: 'jane@example.com',
          age: 25,
          status: 'Active'
        },
        {
          id: 3,
          name: 'Bob Johnson',
          email: 'bob@example.com',
          age: 35,
          status: 'Inactive'
        },
        {
          id: 4,
          name: 'Alice Brown',
          email: 'alice@example.com',
          age: 28,
          status: 'Active'
        }
      ]
    }
  },
  methods: {
    isValidUrl(string) {
      try {
        const url = new URL(string.trim());
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch (_) {
        return false;
      }
    },

    async loadJsonData() {
      if (!this.jsonInput.trim()) {
        alert('Please enter JSON data or a URL');
        return;
      }

      const input = this.jsonInput.trim();
      this.isLoading = true;

      try {
        let data;
        
        if (this.isValidUrl(input)) {
          // Fetch data from URL
          console.log('Fetching data from URL:', input);
          
          const headers = {
            'Content-Type': 'application/json'
          };
          
          // Add Authorization header if bearer token is provided
          if (this.bearerToken.trim()) {
            headers['Authorization'] = `Bearer ${this.bearerToken.trim()}`;
          }
          
          const response = await fetch(input, {
            method: 'GET',
            headers: headers
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            console.warn('Response may not be JSON, attempting to parse anyway');
          }
          
          data = await response.json();
        } else {
          // Parse as JSON string
          data = JSON.parse(input);
        }
        
        // Handle wrapped response: if it's an object with a single "value" key containing an array
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          const keys = Object.keys(data);
          if (keys.length === 1 && keys[0] === 'value' && Array.isArray(data.value)) {
            console.log('Found wrapped response with "value" key, extracting array');
            data = data.value;
          }
        }
        
        if (Array.isArray(data)) {
          this.rows = data;
          this.updateColumns(data);
          this.jsonInput = '';
        } else {
          alert('The data must be a JSON array. Please ensure the URL returns a JSON array or enter a valid JSON array.');
        }
      } catch (error) {
        console.error('Error loading data:', error);
        if (this.isValidUrl(input)) {
          alert(`Error fetching data from URL: ${error.message}`);
        } else {
          alert(`Invalid JSON format: ${error.message}`);
        }
      } finally {
        this.isLoading = false;
      }
    },
    
    updateColumns(data) {
      if (data.length > 0) {
        const sampleRow = data[0]
        const newColumns = Object.keys(sampleRow).map(key => ({
          label: key.charAt(0).toUpperCase() + key.slice(1),
          field: key,
          type: typeof sampleRow[key] === 'number' ? 'number' : 'string'
        }))
        
        this.columns = newColumns
      }
    },
    
    clearData() {
      this.rows = []
      this.jsonInput = ''
      this.bearerToken = ''
    }
  }
}
</script>

<style>
/* Global Styles */
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: #f5f5f5;
}

#app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

/* Header Styles */
.app-header {
  text-align: center;
  margin-bottom: 40px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.app-header h1 {
  color: #2c3e50;
  margin: 0 0 10px 0;
}

.app-header p {
  color: #7f8c8d;
  margin: 0;
}

/* Main Content */
.main-content {
  display: grid;
  gap: 30px;
}

.table-container {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.table-container h2 {
  margin: 0 0 20px 0;
  color: #2c3e50;
}

/* JSON Input Section */
.json-input-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.json-input-section h3 {
  margin: 0 0 15px 0;
  color: #2c3e50;
}

.json-textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  resize: vertical;
  margin-bottom: 15px;
}

.json-textarea:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

/* Authentication Section */
.auth-section {
  margin-bottom: 15px;
}

.token-label {
  display: block;
  margin-bottom: 5px;
  font-size: 14px;
  font-weight: 500;
  color: #2c3e50;
}

.token-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.token-input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

/* Button Styles */
.button-group {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.btn-primary {
  background-color: #3498db;
  color: white;
}

.btn-primary:hover {
  background-color: #2980b9;
}

.btn-primary:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #95a5a6;
  color: white;
}

.btn-secondary:hover {
  background-color: #7f8c8d;
}

.btn-danger {
  background-color: #e74c3c;
  color: white;
  margin-left: 5px;
}

.btn-danger:hover {
  background-color: #c0392b;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

/* Vue Good Table Customizations */
.vgt-table {
  border-collapse: collapse;
  width: 100%;
}

.vgt-table.striped tbody tr:nth-child(odd) {
  background-color: #f8f9fa;
}

.vgt-table.bordered {
  border: 1px solid #dee2e6;
}

.vgt-table.bordered th,
.vgt-table.bordered td {
  border: 1px solid #dee2e6;
}

/* Responsive Design */
@media (max-width: 768px) {
  #app {
    padding: 10px;
  }
  
  .button-group {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
}
</style>
