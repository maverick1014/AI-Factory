/**
 * JSON Schemas for the agents that emit structured (JSON) output.
 *
 * These are passed to the Messages API via `output_config.format` so the model
 * is constrained to valid, parseable JSON. They intentionally avoid unsupported
 * keywords (minLength / minimum / etc.) and set `additionalProperties: false`
 * on every object, as required by structured outputs.
 */

type JsonSchema = Record<string, unknown>;

const namedAsset: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
  },
  required: ['name', 'description'],
};

export const requirementsSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    genre: { type: 'string' },
    core_loop: { type: 'string' },
    player_goal: { type: 'string' },
    mechanics: { type: 'array', items: { type: 'string' } },
    features: { type: 'array', items: { type: 'string' } },
    platform: { type: 'string' },
    multiplayer: { type: 'boolean' },
    complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: [
    'genre',
    'core_loop',
    'player_goal',
    'mechanics',
    'features',
    'platform',
    'multiplayer',
    'complexity',
  ],
};

export const architectureSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    engine: { type: 'string', enum: ['phaser', 'pixi', 'three'] },
    language: { type: 'string' },
    structure: {
      type: 'object',
      additionalProperties: false,
      properties: {
        modules: { type: 'array', items: { type: 'string' } },
        core_classes: { type: 'array', items: { type: 'string' } },
        data_flow: { type: 'array', items: { type: 'string' } },
      },
      required: ['modules', 'core_classes', 'data_flow'],
    },
    state_management: { type: 'string' },
    rendering_strategy: { type: 'string' },
    networking: { type: 'string' },
  },
  required: [
    'engine',
    'language',
    'structure',
    'state_management',
    'rendering_strategy',
    'networking',
  ],
};

export const taskPlanSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['code', 'asset', 'config'] },
          dependency: { type: 'array', items: { type: 'string' } },
          description: { type: 'string' },
        },
        required: ['id', 'name', 'type', 'dependency', 'description'],
      },
    },
  },
  required: ['tasks'],
};

export const assetSpecSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sprites: { type: 'array', items: namedAsset },
    animations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          frames: { type: 'integer' },
        },
        required: ['name', 'description'],
      },
    },
    audio: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string' },
        },
        required: ['name', 'description'],
      },
    },
    effects: { type: 'array', items: namedAsset },
  },
  required: ['sprites', 'animations', 'audio', 'effects'],
};

export const imagePromptsSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    prompts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          asset: { type: 'string' },
          prompt: { type: 'string' },
        },
        required: ['asset', 'prompt'],
      },
    },
  },
  required: ['prompts'],
};

export const audioSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    music: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          mood: { type: 'string' },
          tempo: { type: 'string' },
        },
        required: ['name', 'description'],
      },
    },
    sfx: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          trigger: { type: 'string' },
        },
        required: ['name', 'description'],
      },
    },
  },
  required: ['music', 'sfx'],
};

export const reviewSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          file: { type: 'string' },
          problem: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          fix: { type: 'string' },
        },
        required: ['file', 'problem', 'severity', 'fix'],
      },
    },
  },
  required: ['issues'],
};

export const testReportSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    bugs_found: { type: 'array', items: { type: 'string' } },
    playability_score: { type: 'integer' },
    critical_failures: { type: 'array', items: { type: 'string' } },
  },
  required: ['bugs_found', 'playability_score', 'critical_failures'],
};

export const balanceSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fun_score: { type: 'integer' },
    issues: { type: 'array', items: { type: 'string' } },
    suggested_adjustments: { type: 'array', items: { type: 'string' } },
  },
  required: ['fun_score', 'issues', 'suggested_adjustments'],
};

export const buildSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    files: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string' },
          contents: { type: 'string' },
        },
        required: ['path', 'contents'],
      },
    },
    entry: { type: 'string' },
    dependencies: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
        },
        required: ['name', 'version'],
      },
    },
    instructions: { type: 'string' },
  },
  required: ['files', 'entry', 'dependencies', 'instructions'],
};

export const deploymentSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    build_command: { type: 'string' },
    hosting: { type: 'string' },
    cdn_assets: { type: 'array', items: { type: 'string' } },
    env_vars: { type: 'array', items: { type: 'string' } },
  },
  required: ['build_command', 'hosting', 'cdn_assets', 'env_vars'],
};

export const analyticsSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    events: { type: 'array', items: { type: 'string' } },
    funnels: { type: 'array', items: { type: 'string' } },
    retention_metrics: { type: 'array', items: { type: 'string' } },
  },
  required: ['events', 'funnels', 'retention_metrics'],
};
