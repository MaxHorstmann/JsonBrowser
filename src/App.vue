<template>
  <div id="app">
    <header class="app-header">
      <h1>Mini Azure Resource Browser</h1>
    </header>

    <main class="main-content">
      <!-- JSON Input Section -->
      <div class="json-input-section">
        <h3>Azure API Configuration</h3>
        <div class="config-row">
          <div class="auth-section">
            <label for="subscriptionId" class="token-label">Subscription:</label>
            <select
              id="subscriptionId"
              v-model="subscriptionId"
              class="token-input"
              autocomplete="off"
              data-lpignore="true"
              data-form-type="other"
            >
              <option value="">Select a subscription...</option>
              <option 
                v-for="subscription in subscriptions" 
                :key="subscription.id" 
                :value="subscription.id"
              >
                {{ subscription.name }} ({{ subscription.id }})
              </option>
            </select>
          </div>
          <div class="auth-section">
            <div class="endpoint-info">
              <span class="token-label">Resource Manager Endpoint:</span>
              <span class="endpoint-text">{{ azureEndpoint }}</span>
            </div>
            <div class="token-status">
              <span class="token-label">Authentication Status:</span>
              <span v-if="bearerToken" class="status-indicator status-success">
                ✓ Bearer token loaded securely
              </span>
              <span v-else class="status-indicator status-warning">
                ⚠ No bearer token - requests will be unauthenticated
              </span>
            </div>
          </div>
        </div>
        <div class="data-input-section">
          <label for="apiPathSelect" class="token-label">Azure API Endpoints:</label>
          <select
            id="apiPathSelect"
            v-model="selectedApiPath"
            @change="onApiPathSelect"
            class="token-input"
            :disabled="isLoading"
          >
            <option value="/subscriptions/{subscription-id}/resourceGroups">/subscriptions/{subscription-id}/resourceGroups - List Resource Groups</option>
              <option value="/subscriptions/{subscription-id}/resources">/subscriptions/{subscription-id}/resources - List All Resources</option>
            <option value="/subscriptions/{subscription-id}/providers/Microsoft.DevCenter/devcenters">/subscriptions/{subscription-id}/providers/Microsoft.DevCenter/devcenters - List Dev Centers</option>
            <option value="/subscriptions/{subscription-id}/providers/Microsoft.DevCenter/projects">/subscriptions/{subscription-id}/providers/Microsoft.DevCenter/projects - List Projects</option>
          </select>
        </div>
        
        <!-- Error Display Section -->
        <div v-if="errorResponse" class="error-section">
          <h4 class="error-title">{{ getResponseTitle() }}</h4>
          <textarea 
            v-model="errorResponse" 
            class="error-console" 
            readonly
            rows="10"
          ></textarea>
        </div>
      </div>

      <div v-if="rows.length > 0 && !errorResponse" class="table-container">
        
        <!-- Vue Good Table Component -->
        <vue-good-table
          :columns="columns"
          :rows="rows"
          :pagination-options="{
            enabled: true,
            mode: 'records',
            perPage: -1,
            perPageDropdown: [10, 20, 50, 100],
            dropdownAllowAll: true,
          }"
          :search-options="{
            enabled: true,
            trigger: 'keyup',
            searchFn: multiWordSearch
          }"
          :sort-options="{
            enabled: true,
            multipleColumns: true
          }"
          styleClass="vgt-table striped bordered"
        >
          <template #table-row="props">
            <span 
              v-if="isJsonValue(props.formattedRow[props.column.field])"
              class="json-cell"
              @mouseenter="showJsonPopup($event, props.formattedRow[props.column.field])"
              @mouseleave="hideJsonPopup"
            >
              {{ getJsonPreview(props.formattedRow[props.column.field]) }}
            </span>
            <span 
              v-else
              class="regular-cell"
            >
              {{ props.formattedRow[props.column.field] }}
            </span>
          </template>
        </vue-good-table>
        
        <!-- JSON Popup -->
        <div 
          v-if="jsonPopup.show" 
          class="json-popup"
          :style="{ top: jsonPopup.top + 'px', left: jsonPopup.left + 'px' }"
        >
          <pre class="json-content">{{ jsonPopup.content }}</pre>
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
      selectedApiPath: '/subscriptions/{subscription-id}/resourceGroups',
      azureEndpoint: 'https://management.azure.com',
      subscriptionId: '',
      subscriptions: [],
      bearerToken: '',
      isLoading: false,
      errorResponse: '',
      columns: [],
      rows: [],
      jsonPopup: {
        show: false,
        content: '',
        top: 0,
        left: 0
      }
    }
  },
  async mounted() {
    console.log('App mounted - Loading Azure configuration...');
    try {
      await this.loadAzureConfig();
      
      // Load bearer token from environment variable if available
      const envToken = import.meta.env.VITE_AZURE_TOKEN;
      if (envToken) {
        this.bearerToken = envToken;
        console.log('✓ Loaded bearer token from environment variable');
      }
      
      console.log('✓ Azure configuration loading completed');
      
      // Automatically load data for the default selected API path
      if (this.selectedApiPath && this.subscriptionId) {
        console.log('Auto-loading data for default API path...');
        await this.loadJsonData(this.selectedApiPath);
      }
    } catch (error) {
      console.error('Error during Azure config loading:', error);
    }
  },
  methods: {
    async loadAzureConfig() {
      try {
        console.log('Attempting to load azure-config.json...');
        
        // Add a timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 5000); // 5 second timeout
        
        const response = await fetch('./azure-config.json', {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const config = await response.json();
          console.log('✓ Azure config file loaded successfully');
          
          if (config.endpoint) {
            this.azureEndpoint = config.endpoint;
            console.log('✓ Loaded Resource Manager endpoint:', config.endpoint);
          }
          
          if (config.subscriptions && Array.isArray(config.subscriptions)) {
            this.subscriptions = config.subscriptions;
            console.log('✓ Loaded', config.subscriptions.length, 'subscriptions');
            console.log('First few subscriptions:', config.subscriptions.slice(0, 3));
            
            // Set default subscription if available
            if (config.defaultSubscriptionId) {
              this.subscriptionId = config.defaultSubscriptionId;
              const defaultSub = config.subscriptions.find(sub => sub.id === config.defaultSubscriptionId);
              if (defaultSub) {
                console.log('✓ Set default subscription:', defaultSub.name);
                
                // Auto-load data if we have both subscription and API path
                if (this.selectedApiPath) {
                  console.log('Auto-loading data with default subscription...');
                  setTimeout(() => {
                    this.loadJsonData(this.selectedApiPath);
                  }, 100); // Small delay to ensure UI is ready
                }
              }
            }
          } else {
            console.warn('No subscriptions found in config or invalid format:', config.subscriptions);
          }
          
          if (config.timestamp) {
            console.log('Configuration loaded from:', config.timestamp);
          }
        } else {
          console.warn(`Could not load azure-config.json (HTTP ${response.status}) - run load-azure-config.js first`);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.warn('Azure configuration loading timed out after 5 seconds');
        } else {
          console.warn('Could not load Azure configuration:', error.message);
        }
      }
    },

    async loadResourceManagerEndpoint() {
      // This method is now simplified - just reload the config
      await this.loadAzureConfig();
    },

    async loadBearerToken() {
      // This method is now simplified - just reload the config
      await this.loadAzureConfig();
    },

    async onApiPathSelect() {
      if (this.selectedApiPath) {
        // Automatically load data when a path is selected
        await this.loadJsonData(this.selectedApiPath);
      }
    },

    isValidUrl(string) {
      try {
        const url = new URL(string.trim());
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch (_) {
        return false;
      }
    },

    async loadJsonData(apiPath = null) {
      const inputPath = apiPath || this.selectedApiPath;
      
      if (!inputPath || !inputPath.trim()) {
        alert('Please select an API endpoint from the dropdown');
        return;
      }

      const input = inputPath.trim();
      this.isLoading = true;
      this.errorResponse = ''; // Clear any previous errors

      try {
        let data;
        let fetchUrl = input;
        let contentType = ''; // Declare contentType in broader scope
        
        // If input starts with '/', treat it as an Azure API path and prepend the Azure endpoint
        if (input.startsWith('/')) {
          fetchUrl = this.azureEndpoint.replace(/\/$/, '') + input;
          
          // Replace {subscription-id} placeholder with actual subscription ID if provided
          if (this.subscriptionId.trim() && fetchUrl.includes('{subscription-id}')) {
            fetchUrl = fetchUrl.replace(/\{subscription-id\}/g, this.subscriptionId.trim());
          }
          
          // Add api-version query parameter (required for all Azure API requests)
          let apiVersion = '2021-04-01'; // Standard API version for most resource management operations
          
          // Use newer API version for Dev Center resources
          if (fetchUrl.includes('/providers/Microsoft.DevCenter/')) {
            apiVersion = '2024-02-01'; // Use a stable API version for Dev Center
          }
          
          const separator = fetchUrl.includes('?') ? '&' : '?';
          fetchUrl += `${separator}api-version=${apiVersion}`;
          
          console.log('Building Azure API URL:', fetchUrl);
        }
        
        if (this.isValidUrl(fetchUrl)) {
          // Fetch data from URL
          console.log('Fetching data from URL:', fetchUrl);
          
          const headers = {
            'Content-Type': 'application/json'
          };
          
          // Add Authorization header if bearer token is provided
          if (this.bearerToken.trim()) {
            headers['Authorization'] = `Bearer ${this.bearerToken.trim()}`;
          }
          
          const response = await fetch(fetchUrl, {
            method: 'GET',
            headers: headers
          });
          
          const responseText = await response.text();
          
          if (!response.ok) {
            // Display the error response in the console-style text area
            let errorDisplay = `HTTP ${response.status} ${response.statusText}\n`;
            errorDisplay += `URL: ${fetchUrl}\n`;
            errorDisplay += `Headers: ${JSON.stringify(Object.fromEntries(response.headers), null, 2)}\n\n`;
            errorDisplay += `Response Body:\n${responseText}`;
            
            this.errorResponse = errorDisplay;
            // Don't show popup for HTTP errors - just display in console
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          contentType = response.headers.get('content-type') || 'unknown';
          if (!contentType.includes('application/json')) {
            console.warn('Response may not be JSON, attempting to parse anyway');
          }
          
          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            // If JSON parsing fails, show the raw response
            let errorDisplay = `JSON Parse Error\n`;
            errorDisplay += `URL: ${fetchUrl}\n`;
            errorDisplay += `Content-Type: ${contentType}\n\n`;
            errorDisplay += `Raw Response:\n${responseText}`;
            
            this.errorResponse = errorDisplay;
            throw new Error(`Failed to parse JSON response: ${parseError.message}`);
          }
        } else {
          alert('Please select a valid API endpoint from the dropdown');
          return;
        }
        
        // Handle wrapped response: if it's an object with a "value" key containing an array
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          if (data.hasOwnProperty('value') && Array.isArray(data.value)) {
            console.log('Found wrapped response with "value" key, extracting array');
            data = data.value;
          }
        }
        
        if (Array.isArray(data)) {
          this.rows = data;
          this.updateColumns(data);
          // Clear error response on successful load
          this.errorResponse = '';
          // Don't clear the selection - keep it so user can see what was loaded
        } else {
          // Show the non-array response in the console-style display
          let responseDisplay = `Non-Array Response\n`;
          responseDisplay += `URL: ${fetchUrl}\n`;
          responseDisplay += `Content-Type: ${contentType || 'unknown'}\n\n`;
          responseDisplay += `Response Body:\n${JSON.stringify(data, null, 2)}`;
          
          this.errorResponse = responseDisplay;
        }
      } catch (error) {
        console.error('Error loading data:', error);
        
        // If errorResponse is not already set, set a generic error message
        if (!this.errorResponse) {
          this.errorResponse = `Error: ${error.message}\n\nPlease check the console for more details.`;
        }
        
        // Only show popup for non-HTTP errors (network issues, etc.)
        if (!error.message.includes('HTTP error!')) {
          alert(`Error fetching data from API: ${error.message}`);
        }
      } finally {
        this.isLoading = false;
      }
    },
    
    updateColumns(data) {
      if (data.length > 0) {
        const sampleRow = data[0]
        
        // Add data columns
        const newColumns = Object.keys(sampleRow).map(key => {
          const column = {
            label: key.charAt(0).toUpperCase() + key.slice(1),
            field: key,
            type: typeof sampleRow[key] === 'number' ? 'number' : 'string'
          }
          
          // Set default widths based on data type and content
          if (typeof sampleRow[key] === 'number') {
            column.width = '100px'
          } else if (key.toLowerCase().includes('id')) {
            column.width = '80px'
          } else if (key.toLowerCase().includes('email')) {
            column.width = '200px'
          } else if (key.toLowerCase().includes('status')) {
            column.width = '120px'
          } else {
            column.width = '150px'
          }
          
          return column
        })
        
        this.columns = newColumns
      }
    },

    async refreshAzureConfig() {
      console.log('Refreshing Azure configuration...');
      await this.loadAzureConfig();
      console.log('Current subscriptions count:', this.subscriptions.length);
      console.log('Current subscriptionId:', this.subscriptionId);
    },

    getResponseTitle() {
      if (!this.errorResponse) return 'Response';
      
      // Check if it's an error response (starts with HTTP status or contains "Error")
      if (this.errorResponse.startsWith('HTTP ') || 
          this.errorResponse.startsWith('JSON Parse Error') || 
          this.errorResponse.startsWith('Error:')) {
        return 'Error Response';
      }
      
      // Otherwise, it's just a response display (like non-array response)
      return 'Response';
    },

    multiWordSearch(row, col, cellValue, searchTerm) {
      // If no search term, show all rows
      if (!searchTerm || searchTerm.trim() === '') {
        return true;
      }
      
      // Split search term by spaces and filter out empty strings
      const searchWords = searchTerm.toLowerCase().trim().split(/\s+/).filter(word => word.length > 0);
      
      // If no valid search words, show all rows
      if (searchWords.length === 0) {
        return true;
      }
      
      // Get all searchable text from the row
      let searchableText = '';
      
      // Collect text from all columns
      this.columns.forEach(column => {
        const value = row[column.field];
        if (value !== null && value !== undefined) {
          searchableText += String(value).toLowerCase() + ' ';
        }
      });
      
      // Check if all search words are found in the searchable text
      return searchWords.every(word => searchableText.includes(word));
    },

    isJsonValue(value) {
      // Debug: log every value being checked
      console.log('Checking value for JSON popup:', { value, type: typeof value });
      
      // Check if it's already an object or array
      if (typeof value === 'object' && value !== null) {
        console.log('✓ Found object/array value:', value);
        return true;
      }
      
      // Check if it's a string that contains JSON
      if (typeof value === 'string') {
        // Look for JSON-like strings (starts with { or [)
        const trimmed = value.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
            const parsed = JSON.parse(value);
            if (typeof parsed === 'object' && parsed !== null) {
              console.log('✓ Found JSON string value:', parsed);
              return true;
            }
          } catch {
            // If it looks like JSON but doesn't parse, still treat as JSON for display
            console.log('✓ Found JSON-like string that failed to parse:', value);
            return true;
          }
        }
        
        // Also show popup for long strings or URLs for better readability
        if (trimmed.length > 50 || 
            trimmed.includes('http://') || 
            trimmed.includes('https://') ||
            trimmed.includes('/subscriptions/') ||
            trimmed.includes('/resourceGroups/')) {
          console.log('✓ Found long string or URL value:', value);
          return true;
        }
        
        // TEMPORARY: For testing, make ALL strings with certain patterns show popups
        if (trimmed.includes('id') || trimmed.includes('name') || trimmed.length > 20) {
          console.log('✓ Found test string value:', value);
          return true;
        }
      }
      
      console.log('✗ Not a JSON value:', value);
      return false;
    },

    getJsonPreview(value) {
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          return `[Array ${value.length}]`;
        } else {
          // Show actual object content, truncated if too long
          const jsonStr = JSON.stringify(value);
          return jsonStr.length > 100 ? jsonStr.substring(0, 97) + '...' : jsonStr;
        }
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        // Check for JSON strings
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
            const parsed = JSON.parse(value);
            if (typeof parsed === 'object' && parsed !== null) {
              if (Array.isArray(parsed)) {
                return `[Array ${parsed.length}]`;
              } else {
                // Show actual parsed object content
                const jsonStr = JSON.stringify(parsed);
                return jsonStr.length > 100 ? jsonStr.substring(0, 97) + '...' : jsonStr;
              }
            }
          } catch {
            // If it looks like JSON but doesn't parse, show as JSON-like
            return trimmed.length > 100 ? trimmed.substring(0, 97) + '...' : trimmed;
          }
        }
        
        // For long strings or URLs, show truncated preview
        if (trimmed.length > 50) {
          return trimmed.substring(0, 47) + '...';
        } else if (trimmed.includes('http://') || trimmed.includes('https://')) {
          return '🔗 ' + (trimmed.length > 40 ? trimmed.substring(0, 37) + '...' : trimmed);
        } else if (trimmed.includes('/subscriptions/') || trimmed.includes('/resourceGroups/')) {
          return '📁 ' + (trimmed.length > 40 ? trimmed.substring(0, 37) + '...' : trimmed);
        }
      }
      return String(value).length > 50 ? String(value).substring(0, 50) + '...' : String(value);
    },

    showJsonPopup(event, value) {
      console.log('🎯 POPUP SHOW - showJsonPopup called with:', { 
        event: event.type, 
        target: event.target, 
        value, 
        clientX: event.clientX, 
        clientY: event.clientY 
      });
      
      let jsonContent;
      
      if (typeof value === 'object' && value !== null) {
        jsonContent = JSON.stringify(value, null, 2);
      } else if (typeof value === 'string') {
        const trimmed = value.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
            const parsed = JSON.parse(value);
            if (typeof parsed === 'object' && parsed !== null) {
              jsonContent = JSON.stringify(parsed, null, 2);
            } else {
              jsonContent = value;
            }
          } catch {
            // Show the raw string if it can't be parsed
            jsonContent = value;
          }
        } else {
          // For long strings, URLs, or paths, just show the full content nicely formatted
          jsonContent = value;
        }
      } else {
        jsonContent = String(value);
      }

      // Get the element's position relative to the document
      const rect = event.target.getBoundingClientRect();
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      
      // Calculate position relative to the document
      let left = rect.right + scrollX + 10;
      let top = rect.top + scrollY;
      
      // Popup dimensions (estimated)
      const popupWidth = 500;
      const popupHeight = 400;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Adjust horizontally if popup would go off-screen
      if (left + popupWidth > viewportWidth + scrollX) {
        left = rect.left + scrollX - popupWidth - 10;
      }
      
      // Adjust vertically if popup would go off-screen
      if (top + popupHeight > viewportHeight + scrollY) {
        top = rect.bottom + scrollY - popupHeight;
      }
      
      // Ensure popup doesn't go off the edges
      if (left < scrollX + 10) left = scrollX + 10;
      if (top < scrollY + 10) top = scrollY + 10;

      this.jsonPopup = {
        show: true,
        content: jsonContent,
        top: top,
        left: left
      };
      
      console.log('🎯 POPUP SET - JSON popup configured:', this.jsonPopup);
    },

    hideJsonPopup() {
      console.log('🎯 POPUP HIDE - hideJsonPopup called');
      this.jsonPopup.show = false;
    },

    clearData() {
      this.rows = []
      this.selectedApiPath = ''
      this.errorResponse = ''
      // Don't clear subscriptionId - keep it selected
      // Don't clear the Azure config - keep it loaded
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
  width: 100%;
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
  overflow-x: auto;
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
.config-row {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
}

.config-row .auth-section {
  flex: 1;
  margin-bottom: 0;
}

.auth-section {
  margin-bottom: 15px;
}

.token-status {
  display: flex;
  align-items: center;
  gap: 10px;
}

.endpoint-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.endpoint-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: #666;
  background-color: #f8f9fa;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.status-indicator {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-warning {
  background-color: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.data-input-section {
  margin-bottom: 15px;
}

/* Error Display Section */
.error-section {
  margin-top: 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
}

.error-title {
  margin: 0 0 10px 0;
  color: #dc3545;
  font-size: 16px;
  font-weight: 600;
}

.error-console {
  width: 100%;
  padding: 12px;
  background-color: #000;
  color: #00ff00;
  border: 1px solid #333;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.4;
  resize: vertical;
  min-height: 200px;
  overflow-x: auto;
  white-space: pre;
}

.error-console:focus {
  outline: none;
  border-color: #666;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
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
  table-layout: auto;
  min-width: 100%;
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
  padding: 8px 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
  transition: all 0.15s ease;
}

.vgt-table th {
  background-color: #f8f9fa;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 2px solid #dee2e6;
}

/* Enhanced custom cell styles */
.json-cell {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 3px;
  display: inline-block;
  transition: background-color 0.15s ease;
}

.json-cell:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.regular-cell {
  cursor: default;
  padding: 4px 8px;
  display: inline-block;
  border-radius: 3px;
  transition: background-color 0.15s ease;
}

.regular-cell:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

/* JSON Popup */
.json-popup {
  position: absolute;
  background: #ffffff;
  color: #333333;
  border: 1px solid #cccccc;
  border-radius: 6px;
  padding: 16px;
  max-width: 500px;
  max-height: 400px;
  overflow: auto;
  z-index: 9999;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
  animation: fadeIn 0.2s ease-in;
  backdrop-filter: blur(8px);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.json-content {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #333333;
  background-color: #f8f9fa;
  padding: 12px;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

/* Additional table row hover effects */
.vgt-table tbody tr {
  transition: background-color 0.15s ease;
}

.vgt-table tbody tr:hover {
  background-color: #f8f9fa !important;
}

.vgt-table tbody tr:hover td {
  border-color: #dee2e6;
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
