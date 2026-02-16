#!/usr/bin/env node
// cli.js

import { Command } from 'commander';
import { handleOptIn } from './commands/optInToAsset.js';
import { handleCallFunction } from './src/commands/callFunction.js';
import { handleDeploy } from './src/commands/deploy.js';

const program = new Command();

program
  .name('platform')
  .description('CLI for peer-to-peer ticketing platform')
  .version('1.0.0');

// Create Component Command
program
  .command('opt-in')
  .argument('<assetId>', 'the asset the contract has to opt-in to')
  .description('Opt in the contract to an asset')
  .action(async (assetId) => {
    try {
      await handleOptIn(assetId);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

/*// Call Function Command
program
  .command('call <functionName> [args...]')
  .description('Call a function from your code')
  .action(async (functionName, args) => {
    try {
      await handleCallFunction(functionName, args);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Deploy Command
program
  .command('deploy')
  .description('Deploy the application')
  .option('-e, --env <environment>', 'Deployment environment', 'production')
  .action(async (options) => {
    try {
      await handleDeploy(options.env);
    } catch (error) {
      console.error('Deployment failed:', error.message);
      process.exit(1);
    }
  });*/

program.parse();