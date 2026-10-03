import assert from 'node:assert/strict';
import { doctorNames } from './care-import.js';

assert.deepEqual(doctorNames('Verified OB-GYN service; individual roster NA'), []);
assert.deepEqual(doctorNames('Dr. Benilina O. Badilla; Dr. Elsa P. Khio'), ['Dr. Benilina O. Badilla', 'Dr. Elsa P. Khio']);
assert.deepEqual(doctorNames('Alona P. Manangan, MD'), ['Alona P. Manangan, MD']);
console.log('care import checks passed');