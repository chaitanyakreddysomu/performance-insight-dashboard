import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const source = process.argv[2];
if (!source) throw new Error('Pass the Siemens OpenAPI JSON file path as the first argument.');
const spec = JSON.parse(await readFile(source, 'utf8'));

function dereferenceParameter(parameter) {
  if (!parameter.$ref) return parameter;
  const key = parameter.$ref.split('/').at(-1).replaceAll('~1', '/').replaceAll('~0', '~');
  return spec.components?.parameters?.[key] ?? parameter;
}

const endpoints = [];
for (const [path, item] of Object.entries(spec.paths ?? {})) {
  for (const [method, operation] of Object.entries(item)) {
    if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) continue;
    const parameters = [...(item.parameters ?? []), ...(operation.parameters ?? [])]
      .map(dereferenceParameter)
      .map((parameter) => ({
        name: parameter.name,
        in: parameter.in,
        required: Boolean(parameter.required),
        description: parameter.description,
        example: parameter.example ?? parameter.schema?.example,
        default: parameter.schema?.default,
        type: parameter.schema?.type,
        format: parameter.schema?.format,
        enum: parameter.schema?.enum,
      }));
    const requestContent = operation.requestBody?.content?.['application/json'];
    endpoints.push({
      path,
      method: method.toUpperCase(),
      tags: operation.tags ?? ['Other'],
      summary: operation.summary ?? `${method.toUpperCase()} ${path}`,
      description: operation.description,
      operationId: operation.operationId,
      deprecated: Boolean(operation.deprecated),
      parameters,
      requestBody: operation.requestBody ? {
        required: Boolean(operation.requestBody.required),
        contentType: requestContent ? 'application/json' : Object.keys(operation.requestBody.content ?? {})[0],
        example: requestContent?.example ?? Object.values(requestContent?.examples ?? {})[0]?.value,
        schema: requestContent?.schema,
      } : undefined,
      responses: Object.entries(operation.responses ?? {}).map(([status, response]) => ({
        status,
        description: response.description ?? response.$ref,
      })),
    });
  }
}

const catalog = {
  info: { title: spec.info?.title, version: spec.info?.version, description: spec.info?.description },
  servers: spec.servers ?? [],
  tags: spec.tags ?? [],
  endpointCount: endpoints.length,
  endpoints,
};
const destination = resolve('src/data/iih-essentials-2.7.json');
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, `${JSON.stringify(catalog)}\n`);
console.log(`Wrote ${endpoints.length} operations for IIH Essentials ${spec.info?.version} to ${destination}`);
