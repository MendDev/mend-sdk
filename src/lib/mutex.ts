/**
 * A simple mutex implementation to prevent concurrent operations
 */
export class Mutex {
  private mutex = Promise.resolve();

  /**
   * Acquire the lock and execute the provided function
   * @param fn Function to execute with the lock
   * @returns Promise that resolves with the result of the function
   */
  async lock<T>(fn: () => Promise<T>): Promise<T> {
    let unlock: () => void;

    // Create a new promise that will be resolved when the mutex is released
    const acquireLock = new Promise<void>((resolve) => {
      unlock = resolve;
    });

    // Chain the new promise after the existing mutex
    const oldMutex = this.mutex;
    this.mutex = this.mutex.then(() => acquireLock);

    // Wait for the previous operation to complete
    await oldMutex;

    try {
      // Execute the function with the lock acquired
      return await fn();
    } finally {
      // Release the lock regardless of success or failure
      unlock!();
    }
  }
}
