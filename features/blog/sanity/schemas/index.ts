import type { SchemaTypeDefinition } from "sanity"

import { author } from "./author"
import { post } from "./post"

export const schemaTypes: SchemaTypeDefinition[] = [post, author]
