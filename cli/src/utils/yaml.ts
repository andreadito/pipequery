import { readFile, writeFile } from 'node:fs/promises';
import YAML from 'yaml';

export async function readYaml<T>(path: string): Promise<T> {
  const content = await readFile(path, 'utf-8');
  return YAML.parse(content) as T;
}

export async function writeYaml(path: string, data: unknown): Promise<void> {
  const content = YAML.stringify(data, { lineWidth: 120 });
  await writeFile(path, content, 'utf-8');
}
