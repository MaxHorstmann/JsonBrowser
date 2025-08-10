<template>
  <div id="app">
    <header class="app-header">
      <h1>Mini Azure Resource Browser</h1>
    </header>

    <main class="main-content">
      <!-- Table View -->
      <div v-if="currentView === 'table'">
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

        
        <!-- Table Section -->
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
              <!-- Special handling for ID column - make it a clickable link -->
              <span v-if="props.column.field === 'id'">
                <a 
                  href="#" 
                  @click.prevent="viewResourceDetails(props.row)"
                  class="resource-link"
                >
                  {{ getJsonPreview(props.formattedRow[props.column.field]) }}
                </a>
              </span>
              <!-- Regular JSON cells with hover popup -->
              <span 
                v-else-if="isJsonValue(props.formattedRow[props.column.field])"
                class="json-cell"
                @mouseenter="showJsonPopup($event, props.formattedRow[props.column.field])"
                @mouseleave="hideJsonPopup"
              >
                {{ getJsonPreview(props.formattedRow[props.column.field]) }}
              </span>
              <!-- Regular text cells -->
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
      </div>      <!-- Details View -->
      <div v-else-if="currentView === 'details'" class="details-view">
        <div class="details-header">
          <button @click="goBackToTable" class="back-button">← Back to Table</button>
          <h2>Resource Details</h2>
        </div>
        
        <div class="details-content">
          <div class="details-card">
            <h3>Basic Information</h3>
            <div class="details-grid">
              <div class="detail-item">
                <label>ID:</label>
                <span class="detail-value">{{ selectedResource?.id || 'N/A' }}</span>
              </div>
              <div class="detail-item">
                <label>Name:</label>
                <span class="detail-value">{{ selectedResource?.name || 'N/A' }}</span>
              </div>
              <div class="detail-item">
                <label>Type:</label>
                <span class="detail-value">{{ selectedResource?.type || 'N/A' }}</span>
              </div>
              <div class="detail-item">
                <label>Location:</label>
                <span class="detail-value">{{ selectedResource?.location || 'N/A' }}</span>
              </div>
              <div class="detail-item" v-if="selectedResource?.resourceGroup">
                <label>Resource Group:</label>
                <span class="detail-value">{{ selectedResource.resourceGroup }}</span>
              </div>
            </div>
          </div>

          <div class="details-card">
            <h3>Properties</h3>
            <div class="json-viewer">
              <pre>{{ formatResourceProperties(selectedResource) }}</pre>
            </div>
          </div>

          <div class="details-card">
            <h3>Tags</h3>
            <div v-if="selectedResource?.tags && Object.keys(selectedResource.tags).length > 0" class="tags-grid">
              <div v-for="(value, key) in selectedResource.tags" :key="key" class="tag-item">
                <span class="tag-key">{{ key }}:</span>
                <span class="tag-value">{{ value }}</span>
              </div>
            </div>
            <div v-else class="no-data">No tags available</div>
          </div>

          <div class="details-card">
            <h3>Raw JSON</h3>
            <div class="json-viewer">
              <pre>{{ JSON.stringify(selectedResource, null, 2) }}</pre>
            </div>
          </div>

          <!-- Child Resources Section -->
          <div class="details-card">
            <h3>Child Resources</h3>
            <div v-if="isLoadingChildResources" class="loading-section">
              <p>Loading child resources...</p>
            </div>
            <div v-else-if="childResourceError" class="error-section">
              <p class="error-text">{{ childResourceError }}</p>
            </div>
            <div v-else-if="childResources.length > 0" class="child-resources-section">
              <div class="child-resources-grid">
                <div v-for="(childResource, index) in childResources" :key="index" class="child-resource-card">
                  <div class="child-resource-header">
                    <h4>{{ childResource.name || childResource.id || 'Unknown Resource' }}</h4>
                    <span class="child-resource-type">{{ childResource.type || 'Unknown Type' }}</span>
                  </div>
                  <div class="child-resource-details">
                    <div v-if="childResource.location" class="child-detail-item">
                      <span class="child-label">Location:</span>
                      <span class="child-value">{{ childResource.location }}</span>
                    </div>
                    <div v-if="childResource.properties?.osType" class="child-detail-item">
                      <span class="child-label">OS Type:</span>
                      <span class="child-value">{{ childResource.properties.osType }}</span>
                    </div>
                    <div v-if="childResource.properties?.devBoxDefinitionName" class="child-detail-item">
                      <span class="child-label">Dev Box Definition:</span>
                      <span class="child-value">{{ childResource.properties.devBoxDefinitionName }}</span>
                    </div>
                    <div v-if="childResource.properties?.networkConnectionName" class="child-detail-item">
                      <span class="child-label">Network Connection:</span>
                      <span class="child-value">{{ childResource.properties.networkConnectionName }}</span>
                    </div>
                    <div v-if="childResource.properties?.licenseType" class="child-detail-item">
                      <span class="child-label">License Type:</span>
                      <span class="child-value">{{ childResource.properties.licenseType }}</span>
                    </div>
                    <div v-if="childResource.properties?.localAdministrator" class="child-detail-item">
                      <span class="child-label">Local Administrator:</span>
                      <span class="child-value">{{ childResource.properties.localAdministrator }}</span>
                    </div>
                  </div>
                  <div class="child-resource-json">
                    <details>
                      <summary>View Full JSON</summary>
                      <pre class="child-json-content">{{ JSON.stringify(childResource, null, 2) }}</pre>
                    </details>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="no-data">No child resources found</div>
          </div>
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
      },
      // View state management
      currentView: 'table', // 'table' or 'details'
      selectedResource: null,
      // Child resources for details view
      childResources: [],
      isLoadingChildResources: false,
      childResourceError: null
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

    viewResourceDetails(resource) {
      console.log('📋 VIEW DETAILS - Opening details for resource:', resource);
      this.selectedResource = resource;
      this.currentView = 'details';
      this.childResources = [];
      this.childResourceError = null;
      
      // Load child resources if available
      this.loadChildResources(resource);
    },

    goBackToTable() {
      console.log('🔙 BACK TO TABLE - Returning to table view');
      this.currentView = 'table';
      this.selectedResource = null;
      this.childResources = [];
      this.childResourceError = null;
    },

    async loadChildResources(parentResource) {
      console.log('🔄 LOADING CHILD RESOURCES for:', parentResource);
      
      if (!parentResource.id) {
        console.log('No resource ID available for child resource lookup');
        return;
      }

      this.isLoadingChildResources = true;
      this.childResourceError = null;

      try {
        const childEndpoints = this.getChildResourceEndpoints(parentResource);
        console.log('Child endpoints to fetch:', childEndpoints);
        
        if (childEndpoints.length === 0) {
          console.log('No child resource endpoints found for this resource type');
          this.childResources = [];
          return;
        }

        let allChildResources = [];

        // Load child resources from all endpoints
        for (const endpoint of childEndpoints) {
          try {
            console.log(`Fetching child resources from: ${endpoint.url}`);
            const childData = await this.fetchChildResourceData(endpoint);
            if (childData && Array.isArray(childData) && childData.length > 0) {
              // Add resource type information to each child
              const typedChildData = childData.map(child => ({
                ...child,
                _childResourceType: endpoint.type,
                _parentId: parentResource.id
              }));
              
              allChildResources = [...allChildResources, ...typedChildData];
              console.log(`Found ${typedChildData.length} ${endpoint.type} resources`);
            }
          } catch (error) {
            console.error(`Error loading ${endpoint.type} for ${parentResource.name}:`, error);
          }
        }

        this.childResources = allChildResources;
        console.log(`Total child resources loaded: ${allChildResources.length}`);
        
      } catch (error) {
        console.error('Error loading child resources:', error);
        this.childResourceError = `Error loading child resources: ${error.message}`;
      } finally {
        this.isLoadingChildResources = false;
      }
    },

    getChildResourceEndpoints(parentResource) {
      const endpoints = [];
      
      console.log('Determining child endpoints for resource type:', parentResource.type);
      
      // Determine parent resource type and get appropriate child endpoints
      if (parentResource.type === 'Microsoft.DevCenter/projects' || 
          (parentResource.id && parentResource.id.includes('/projects/'))) {
        // For DevCenter projects, load pools
        console.log('DevCenter project detected, adding pools endpoint');
        endpoints.push({
          url: `${parentResource.id}/pools?api-version=2024-02-01`,
          type: 'pools'
        });
      } else if (parentResource.type === 'Microsoft.Storage/storageAccounts' ||
                 (parentResource.id && parentResource.id.includes('/storageAccounts/'))) {
        // For Storage Accounts, load containers
        console.log('Storage Account detected, adding containers endpoint');
        endpoints.push({
          url: `${parentResource.id}/blobServices/default/containers?api-version=2021-04-01`,
          type: 'containers'
        });
      } else if (parentResource.type === 'Microsoft.Resources/resourceGroups' ||
                 (parentResource.id && parentResource.id.includes('/resourceGroups/'))) {
        // For Resource Groups, load all resources in the group
        console.log('Resource Group detected, adding resources endpoint');
        endpoints.push({
          url: `${parentResource.id}/resources?api-version=2021-04-01`,
          type: 'resources'
        });
      } else if (parentResource.type === 'Microsoft.Web/sites' ||
                 (parentResource.id && parentResource.id.includes('/sites/'))) {
        // For App Services, load deployment slots
        console.log('App Service detected, adding slots endpoint');
        endpoints.push({
          url: `${parentResource.id}/slots?api-version=2021-02-01`,
          type: 'slots'
        });
      } else if (parentResource.type === 'Microsoft.Compute/virtualMachines' ||
                 (parentResource.id && parentResource.id.includes('/virtualMachines/'))) {
        // For VMs, load extensions
        console.log('Virtual Machine detected, adding extensions endpoint');
        endpoints.push({
          url: `${parentResource.id}/extensions?api-version=2021-07-01`,
          type: 'extensions'
        });
      }
      
      console.log(`Found ${endpoints.length} child endpoints`);
      return endpoints;
    },

    async fetchChildResourceData(endpoint) {
      console.log('Fetching child resource data from:', endpoint.url);
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (this.bearerToken.trim()) {
        headers['Authorization'] = `Bearer ${this.bearerToken.trim()}`;
      }
      
      const response = await fetch(`${this.azureEndpoint.replace(/\/$/, '')}${endpoint.url}`, {
        method: 'GET',
        headers: headers
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle wrapped response
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        if (data.hasOwnProperty('value') && Array.isArray(data.value)) {
          return data.value;
        }
      }
      
      return Array.isArray(data) ? data : [];
    },

    formatResourceProperties(resource) {
      if (!resource) return 'No resource selected';
      
      // Extract meaningful properties excluding the basics already shown
      const excludeKeys = ['id', 'name', 'type', 'location', 'resourceGroup', 'tags'];
      const properties = {};
      
      Object.keys(resource).forEach(key => {
        if (!excludeKeys.includes(key)) {
          properties[key] = resource[key];
        }
      });
      
      return Object.keys(properties).length > 0 
        ? JSON.stringify(properties, null, 2)
        : 'No additional properties available';
    },

    clearData() {
      this.rows = []
      this.selectedApiPath = ''
      this.errorResponse = ''
      this.currentView = 'table'
      this.selectedResource = null
      this.childResources = []
      this.isLoadingChildResources = false
      this.childResourceError = null
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

/* Resource link styles */
.resource-link {
  color: #007acc;
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 3px;
  display: inline-block;
  transition: all 0.15s ease;
  font-weight: 500;
}

.resource-link:hover {
  background-color: rgba(0, 122, 204, 0.1);
  text-decoration: underline;
  color: #005a9e;
}

/* Details View Styles */
.details-view {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

.details-header {
  background: #f8f9fa;
  padding: 20px;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  align-items: center;
  gap: 15px;
}

.back-button {
  background: #007acc;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.15s ease;
}

.back-button:hover {
  background: #005a9e;
}

.details-header h2 {
  margin: 0;
  color: #2c3e50;
  font-size: 24px;
}

.details-content {
  padding: 20px;
  display: grid;
  gap: 20px;
}

.details-card {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 20px;
}

.details-card h3 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 18px;
  border-bottom: 2px solid #007acc;
  padding-bottom: 8px;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item label {
  font-weight: 600;
  color: #495057;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  color: #2c3e50;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  background: white;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #e9ecef;
  word-break: break-all;
}

.tags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
}

.tag-item {
  background: white;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid #e9ecef;
  display: flex;
  gap: 8px;
}

.tag-key {
  font-weight: 600;
  color: #495057;
  font-size: 13px;
}

.tag-value {
  color: #2c3e50;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  word-break: break-all;
}

.json-viewer {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 15px;
  overflow-x: auto;
  max-height: 400px;
}

.json-viewer pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.4;
  color: #2c3e50;
}

.no-data {
  color: #6c757d;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

/* Child Resources Styles */
.loading-section {
  text-align: center;
  padding: 20px;
  color: #6c757d;
}

.error-text {
  color: #dc3545;
  font-weight: 500;
}

.child-resources-section {
  margin-top: 15px;
}

.child-resources-grid {
  display: grid;
  gap: 15px;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
}

.child-resource-card {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  transition: box-shadow 0.15s ease;
}

.child-resource-card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.child-resource-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e9ecef;
}

.child-resource-header h4 {
  margin: 0;
  color: #2c3e50;
  font-size: 16px;
  font-weight: 600;
  word-break: break-all;
  flex: 1;
  margin-right: 10px;
}

.child-resource-type {
  background: #007acc;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.child-resource-details {
  margin-bottom: 15px;
}

.child-detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 6px 0;
}

.child-label {
  font-weight: 600;
  color: #495057;
  font-size: 13px;
  margin-right: 10px;
  min-width: 120px;
}

.child-value {
  color: #2c3e50;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  text-align: right;
  word-break: break-all;
  flex: 1;
}

.child-resource-json {
  margin-top: 10px;
}

.child-resource-json details {
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 8px;
}

.child-resource-json summary {
  cursor: pointer;
  font-weight: 500;
  color: #007acc;
  font-size: 13px;
  margin-bottom: 8px;
}

.child-resource-json summary:hover {
  color: #005a9e;
}

.child-json-content {
  margin: 8px 0 0 0;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
  line-height: 1.4;
  color: #2c3e50;
  max-height: 200px;
  overflow-y: auto;
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
