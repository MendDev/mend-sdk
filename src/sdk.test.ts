import { describe, it, expect } from 'vitest';
import MendSdk from './index';

describe('MendSdk', () => {
  it('should initialize with valid configuration', () => {
    const sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'test@example.com',
      password: 'password123'
    });
    
    expect(sdk).toBeInstanceOf(MendSdk);
  });
  
  it('should throw error when missing required options', () => {
    expect(() => {
      // @ts-ignore - intentionally missing required properties
      new MendSdk({});
    }).toThrow();
  });
});
