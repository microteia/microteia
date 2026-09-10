// The Cloud Functions of this extension, read through this file: what is exported here is what gets
// deployed. Declare each one in "manifest.backend.functions" too — that is what makes it go up only
// where this extension is installed, by "microteia provision".
//
// Needs an npm package the platform does not carry? Declare it in "dependencies" in a package.json
// next to this file. Needs a credential? defineString('NAME') here, and 'NAME' in
// "manifest.backend.parameters".

export { backendExampleQuote } from './backendExampleQuote';
export { backendExampleOnTicketWritten } from './backendExampleOnTicketWritten';
export { backendExampleNightlySweep } from './backendExampleNightlySweep';
