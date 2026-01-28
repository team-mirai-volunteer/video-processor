export interface AiGateway {
  /**
   * Generate text from prompt
   * @param prompt The input prompt
   * @returns Generated text response
   */
  generate(prompt: string): Promise<string>;
}
