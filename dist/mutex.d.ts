/**
 * A simple mutex implementation to prevent concurrent operations
 */
export declare class Mutex {
    private mutex;
    /**
     * Acquire the lock and execute the provided function
     * @param fn Function to execute with the lock
     * @returns Promise that resolves with the result of the function
     */
    lock<T>(fn: () => Promise<T>): Promise<T>;
}
