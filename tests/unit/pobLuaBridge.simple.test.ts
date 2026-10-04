/**
 * Simple unit tests for PoBLuaApiClient: construction does no I/O, and nothing works before start().
 */
import { describe, it, expect, jest } from '@jest/globals';
import { PoBLuaApiClient, EngineExitedError } from '../../src/pobLuaBridge';
import { makeFakeCheckout } from '../mocks/pobProcess.mock';

function makeClient() {
  const checkout = makeFakeCheckout();
  const spawn = jest.fn(() => {
    throw new Error('spawn must not be called');
  });
  const client = new PoBLuaApiClient({
    env: {},
    spawn: spawn as unknown as typeof import('child_process').spawn,
    pobSrc: checkout.pobSrc,
    pobApiDir: checkout.pobApiDir,
    pin: checkout.pin,
  });
  return { client, spawn };
}

describe('PoBLuaApiClient - Simple Tests', () => {
  describe('Initialization', () => {
    it('constructing a client spawns nothing', () => {
      const { client, spawn } = makeClient();
      expect(client).toBeDefined();
      expect(client.isAlive()).toBe(false);
      expect(client.pid()).toBeNull();
      expect(spawn).not.toHaveBeenCalled();
    });

    it('should handle stop when not started', async () => {
      const { client } = makeClient();
      await expect(client.stop()).resolves.toBeUndefined();
    });
  });

  describe('Error handling before initialization', () => {
    it('ping, getStats and loadBuildXml reject with EngineExitedError and never spawn', async () => {
      const { client, spawn } = makeClient();
      await expect(client.ping()).rejects.toBeInstanceOf(EngineExitedError);
      await expect(client.getStats()).rejects.toBeInstanceOf(EngineExitedError);
      await expect(client.loadBuildXml('<Build></Build>')).rejects.toBeInstanceOf(EngineExitedError);
      expect(spawn).not.toHaveBeenCalled();
    });
  });

  describe('API surface', () => {
    it('keeps the typed wrappers', () => {
      const { client } = makeClient();
      for (const name of [
        'start', 'stop', 'request', 'isAlive', 'pid', 'ping', 'loadBuildXml', 'getStats', 'getTree',
        'setTree', 'getItems', 'addItem', 'setFlaskActive', 'getSkills', 'setMainSelection', 'listGems',
        'getClasses',
      ] as const) {
        expect(typeof client[name]).toBe('function');
      }
    });
  });
});
