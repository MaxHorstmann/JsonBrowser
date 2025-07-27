#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync } from 'fs';

const execAsync = promisify(exec);

async function loadAzureConfig() {
  const config = {
    endpoint: 'https://management.azure.com',
    timestamp: new Date().toISOString(),
    subscriptions: [],
    defaultSubscriptionId: ''
  };

  try {
    console.log('Loading Azure Resource Manager endpoint...');
    const { stdout: endpoint } = await execAsync('az cloud list --query "[?isActive].endpoints.resourceManager" --output tsv');
    if (endpoint.trim()) {
      config.endpoint = endpoint.trim();
      console.log('✓ Loaded endpoint:', config.endpoint);
    }
  } catch (error) {
    console.warn('⚠ Could not load Resource Manager endpoint:', error.message);
  }

  try {
    console.log('Loading Azure subscriptions...');
    const { stdout: subscriptionsJson } = await execAsync('az account list --query "[].{id:id, name:name, isDefault:isDefault}" --output json');
    if (subscriptionsJson.trim()) {
      const subscriptions = JSON.parse(subscriptionsJson.trim());
      config.subscriptions = subscriptions;
      
      // Find the default subscription
      const defaultSub = subscriptions.find(sub => sub.isDefault);
      if (defaultSub) {
        config.defaultSubscriptionId = defaultSub.id;
        console.log('✓ Loaded subscriptions:', subscriptions.length, 'found');
        console.log('✓ Default subscription:', defaultSub.name, `(${defaultSub.id})`);
      } else {
        console.log('✓ Loaded subscriptions:', subscriptions.length, 'found');
        if (subscriptions.length > 0) {
          config.defaultSubscriptionId = subscriptions[0].id;
          console.log('✓ Using first subscription as default:', subscriptions[0].name);
        }
      }
    }
  } catch (error) {
    console.warn('⚠ Could not load subscriptions:', error.message);
  }

  let token = '';
  try {
    console.log('Loading Azure access token...');
    const { stdout: tokenOutput } = await execAsync(`az account get-access-token --resource ${config.endpoint} --query accessToken --output tsv`);
    if (tokenOutput.trim()) {
      token = tokenOutput.trim();
      console.log('✓ Loaded access token (will be stored in environment variable)');
    }
  } catch (error) {
    console.warn('⚠ Could not load access token:', error.message);
  }

  // Write config to public directory (without token for security)
  writeFileSync('./public/azure-config.json', JSON.stringify(config, null, 2));
  console.log('✓ Azure configuration saved to public/azure-config.json');
  
  // Display environment variable instructions
  if (token) {
    console.log('\n🔐 For security, set the token as an environment variable:');
    console.log('export VITE_AZURE_TOKEN="' + token + '"');
    console.log('\nOr run your dev server with:');
    console.log('VITE_AZURE_TOKEN="' + token + '" npm run dev');
  }
}

loadAzureConfig().catch(console.error);
