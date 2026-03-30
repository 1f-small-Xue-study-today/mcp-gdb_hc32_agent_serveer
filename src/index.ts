#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import readline from 'readline';

const SERVER_INFO = {
  name: 'mcp-gdb-server',
  version: '0.2.0',
};

const PROTOCOL_VERSION = '2025-03-26';
const JSONRPC_VERSION = '2.0';
const activeSessions = new Map();

const TOOL_DEFS = [
  {
    name: 'gdb_start',
    description: 'Start a new GDB session',
    inputSchema: {
      type: 'object',
      properties: {
        gdbPath: {
          type: 'string',
          description: 'Path to the GDB executable (optional, defaults to gdb)',
        },
        workingDir: {
          type: 'string',
          description: 'Working directory for GDB (optional)',
        },
      },
    },
  },
  {
    name: 'gdb_load',
    description: 'Load a program into GDB',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'GDB session ID' },
        program: { type: 'string', description: 'Path to the program to debug' },
        arguments: {
          type: 'array',
          items: { type: 'string' },
          description: 'Command-line arguments for the program (optional)',
        },
      },
      required: ['sessionId', 'program'],
    },
  },
  {
    name: 'gdb_command',
    description: 'Execute a raw GDB console command',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'GDB session ID' },
        command: { type: 'string', description: 'GDB command to execute' },
      },
      required: ['sessionId', 'command'],
    },
  },
  {
    name: 'gdb_connect',
    description: 'Connect a GDB session to a remote target',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'GDB session ID' },
        target: {
          type: 'string',
          description: 'Remote target endpoint, for example localhost:2331',
        },
        extendedRemote: {
          type: 'boolean',
          description: 'Use target extended-remote instead of target remote (optional)',
        },
      },
      required: ['sessionId', 'target'],
    },
  },
  {
    name: 'gdb_read_register',
    description: 'Read a single register value',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'GDB session ID' },
        register: { type: 'string', description: 'Register name to read' },
      },
      required: ['sessionId', 'register'],
    },
  },
  {
    name: 'gdb_read_memory',
    description: 'Read memory using GDB examine syntax',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'GDB session ID' },
        address: { type: 'string', description: 'Memory address or expression to read from' },
        format: {
          type: 'string',
          description: 'Display format and unit, for example wx or bx (optional)',
        },
        count: { type: 'number', description: 'Number of values to read (optional)' },
      },
      required: ['sessionId', 'address'],
    },
  },
  {
    name: 'gdb_terminate',
    description: 'Terminate a GDB session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'GDB session ID' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'gdb_list_sessions',
    description: 'List all active GDB sessions',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'gdb_attach',
    description: 'Attach to a running process',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'GDB session ID' },
        pid: { type: 'number', description: 'Process ID to attach to' },
      },
      required: ['sessionId', 'pid'],
    },
  },
  {
    name: 'gdb_load_core',
    description: 'Load a core dump file',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'GDB session ID' },
        program: { type: 'string', description: 'Path to the program executable' },
        corePath: { type: 'string', description: 'Path to the core dump file' },
      },
      required: ['sessionId', 'program', 'corePath'],
    },
  },
  {
    name: 'gdb_set_breakpoint',
    description: 'Set a breakpoint',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'GDB session ID' },
        location: {
          type: 'string',
          description: 'Breakpoint location (for example function name or file:line)',
        },
        condition: { type: 'string', description: 'Breakpoint condition (optional)' },
      },
      required: ['sessionId', 'location'],
    },
  },
  {
    name: 'gdb_continue',
    description: 'Continue program execution',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'GDB session ID' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'gdb_step',
    description: 'Step program execution',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'GDB session ID' },
        instructions: {
          type: 'boolean',
          description: 'Step by instructions instead of source lines (optional)',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'gdb_next',
    description: 'Step over function calls',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'GDB session ID' },
        instructions: {
          type: 'boolean',
          description: 'Step by instructions instead of source lines (optional)',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'gdb_finish',
    description: 'Execute until the current function returns',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'GDB session ID' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'gdb_backtrace',
    description: 'Show call stack',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'GDB session ID' },
        full: {
          type: 'boolean',
          description: 'Show variables in each frame (optional)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of frames to show (optional)',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'gdb_print',
    description: 'Print value of expression',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'GDB session ID' },
        expression: { type: 'string', description: 'Expression to evaluate' },
      },
      required: ['sessionId', 'expression'],
    },
  },
  {
    name: 'gdb_examine',
    description: 'Examine memory',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'GDB session ID' },
        expression: { type: 'string', description: 'Memory address or expression' },
        format: {
          type: 'string',
          description: 'Display format (for example x for hex or i for instruction)',
        },
        count: { type: 'number', description: 'Number of units to display' },
      },
      required: ['sessionId', 'expression'],
    },
  },
  {
    name: 'gdb_info_registers',
    description: 'Display registers',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'GDB session ID' },
        register: {
          type: 'string',
          description: 'Specific register to display (optional)',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'gdb_list_source',
    description: 'List source code at the current location or a specified location',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'GDB session ID' },
        location: {
          type: 'string',
          description: 'Source location such as function name or file:line (optional)',
        },
      },
      required: ['sessionId'],
    },
  },
];

function textResult(text) {
  return {
    content: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

function errorResult(text) {
  return {
    content: [
      {
        type: 'text',
        text,
      },
    ],
    isError: true,
  };
}

class GdbServer {
  constructor() {
    this.buffer = Buffer.alloc(0);
    this.queue = Promise.resolve();

    process.stdin.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.drainMessages();
    });

    process.stdin.on('end', async () => {
      await this.shutdown();
    });

    process.on('SIGINT', async () => {
      await this.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.shutdown();
      process.exit(0);
    });
  }

  async run() {
    console.error('GDB MCP server running on stdio');
  }

  drainMessages() {
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        return;
      }

      const headerText = this.buffer.subarray(0, headerEnd).toString('utf8');
      const headers = {};
      for (const line of headerText.split('\r\n')) {
        if (!line.trim()) {
          continue;
        }
        const separator = line.indexOf(':');
        if (separator === -1) {
          continue;
        }
        const name = line.slice(0, separator).trim().toLowerCase();
        const value = line.slice(separator + 1).trim();
        headers[name] = value;
      }

      const contentLength = Number.parseInt(headers['content-length'] || '', 10);
      if (!Number.isFinite(contentLength) || contentLength < 0) {
        console.error('[MCP Error] Invalid Content-Length header');
        this.buffer = Buffer.alloc(0);
        return;
      }

      const totalLength = headerEnd + 4 + contentLength;
      if (this.buffer.length < totalLength) {
        return;
      }

      const body = this.buffer.subarray(headerEnd + 4, totalLength).toString('utf8');
      this.buffer = this.buffer.subarray(totalLength);

      let message;
      try {
        message = JSON.parse(body);
      } catch (error) {
        console.error('[MCP Error] Failed to parse JSON-RPC message:', error);
        continue;
      }

      this.queue = this.queue
        .then(() => this.handleEnvelope(message))
        .catch((error) => {
          console.error('[MCP Error]', error);
        });
    }
  }

  send(payload) {
    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
    process.stdout.write(body);
  }

  sendResult(id, result) {
    this.send({
      jsonrpc: JSONRPC_VERSION,
      id,
      result,
    });
  }

  sendError(id, code, message) {
    this.send({
      jsonrpc: JSONRPC_VERSION,
      id,
      error: {
        code,
        message,
      },
    });
  }

  async handleEnvelope(message) {
    if (!message || message.jsonrpc !== JSONRPC_VERSION || typeof message.method !== 'string') {
      return;
    }

    const id = message.id;
    const params = message.params || {};

    try {
      switch (message.method) {
        case 'initialize':
          if (id !== undefined) {
            this.sendResult(id, {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: {
                tools: {},
              },
              serverInfo: SERVER_INFO,
            });
          }
          return;

        case 'notifications/initialized':
          return;

        case 'tools/list':
          if (id !== undefined) {
            this.sendResult(id, { tools: TOOL_DEFS });
          }
          return;

        case 'tools/call':
          if (id !== undefined) {
            const result = await this.handleToolCall(params);
            this.sendResult(id, result);
          }
          return;

        default:
          if (id !== undefined) {
            this.sendError(id, -32601, `Method not found: ${message.method}`);
          }
      }
    } catch (error) {
      if (id !== undefined) {
        this.sendError(id, -32000, error instanceof Error ? error.message : String(error));
      }
    }
  }

  async handleToolCall(params) {
    const name = params.name;
    const args = params.arguments || {};

    switch (name) {
      case 'gdb_start':
        return this.handleGdbStart(args);
      case 'gdb_load':
        return this.handleGdbLoad(args);
      case 'gdb_command':
        return this.handleGdbCommand(args);
      case 'gdb_connect':
        return this.handleGdbConnect(args);
      case 'gdb_read_register':
        return this.handleGdbReadRegister(args);
      case 'gdb_read_memory':
        return this.handleGdbReadMemory(args);
      case 'gdb_terminate':
        return this.handleGdbTerminate(args);
      case 'gdb_list_sessions':
        return this.handleGdbListSessions();
      case 'gdb_attach':
        return this.handleGdbAttach(args);
      case 'gdb_load_core':
        return this.handleGdbLoadCore(args);
      case 'gdb_set_breakpoint':
        return this.handleGdbSetBreakpoint(args);
      case 'gdb_continue':
        return this.handleGdbContinue(args);
      case 'gdb_step':
        return this.handleGdbStep(args);
      case 'gdb_next':
        return this.handleGdbNext(args);
      case 'gdb_finish':
        return this.handleGdbFinish(args);
      case 'gdb_backtrace':
        return this.handleGdbBacktrace(args);
      case 'gdb_print':
        return this.handleGdbPrint(args);
      case 'gdb_examine':
        return this.handleGdbExamine(args);
      case 'gdb_info_registers':
        return this.handleGdbInfoRegisters(args);
      case 'gdb_list_source':
        return this.handleGdbListSource(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  getSession(sessionId) {
    return activeSessions.get(sessionId) || null;
  }

  getSessionOrError(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      return {
        session: null,
        response: errorResult(`No active GDB session with ID: ${sessionId}`),
      };
    }
    return { session };
  }

  queueGdbCommand(session, command) {
    const next = session.pending.then(() => this.runGdbCommand(session, command));
    session.pending = next.catch(() => {});
    return next;
  }

  async handleGdbStart(args) {
    const gdbPath = args.gdbPath || 'gdb';
    const workingDir = args.workingDir || process.cwd();
    const sessionId = Date.now().toString();

    try {
      const gdbProcess = spawn(gdbPath, ['--interpreter=mi2', '--quiet', '--nx'], {
        cwd: workingDir,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const rl = readline.createInterface({
        input: gdbProcess.stdout,
        crlfDelay: Infinity,
      });

      const session = {
        process: gdbProcess,
        rl,
        ready: false,
        id: sessionId,
        target: undefined,
        workingDir,
        pending: Promise.resolve(),
      };

      activeSessions.set(sessionId, session);

      let outputBuffer = '';

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('GDB start timeout'));
        }, 10000);

        const onLine = (line) => {
          const decodedLine = this.decodeMiOutputLine(line);
          if (decodedLine.trim()) {
            outputBuffer += decodedLine.endsWith('\n') ? decodedLine : `${decodedLine}\n`;
          }

          if (line.trim() === '(gdb)' || line.startsWith('^done')) {
            session.ready = true;
            cleanup();
            resolve();
          }
        };

        const onStderr = (data) => {
          outputBuffer += `[stderr] ${data.toString()}\n`;
        };

        const onError = (error) => {
          cleanup();
          reject(error);
        };

        const onExit = (code) => {
          cleanup();
          if (!session.ready) {
            reject(new Error(`GDB process exited with code ${code}`));
          }
        };

        const cleanup = () => {
          clearTimeout(timeout);
          rl.removeListener('line', onLine);
          gdbProcess.stderr.removeListener('data', onStderr);
          gdbProcess.removeListener('error', onError);
          gdbProcess.removeListener('exit', onExit);
        };

        rl.on('line', onLine);
        gdbProcess.stderr.on('data', onStderr);
        gdbProcess.on('error', onError);
        gdbProcess.on('exit', onExit);
      });

      outputBuffer += await this.queueGdbCommand(session, 'set pagination off');
      outputBuffer += outputBuffer.endsWith('\n') ? '' : '\n';
      outputBuffer += await this.queueGdbCommand(session, 'set confirm off');

      return textResult(`GDB session started with ID: ${sessionId}\n\nOutput:\n${outputBuffer}`);
    } catch (error) {
      const session = this.getSession(sessionId);
      if (session) {
        session.rl.close();
        if (!session.process.killed) {
          session.process.kill();
        }
        activeSessions.delete(sessionId);
      }

      return errorResult(`Failed to start GDB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async handleGdbLoad(args) {
    const { sessionId, program, arguments: programArgs = [] } = args;
    const resolved = this.getSessionOrError(sessionId);
    if (!resolved.session) {
      return resolved.response;
    }

    const session = resolved.session;

    try {
      const normalizedPath =
        session.workingDir && !path.isAbsolute(program)
          ? path.resolve(session.workingDir, program)
          : program;

      session.target = normalizedPath;
      const loadOutput = await this.queueGdbCommand(session, `file "${normalizedPath}"`);

      let argsOutput = '';
      if (Array.isArray(programArgs) && programArgs.length > 0) {
        const quotedArgs = programArgs.map((value) => JSON.stringify(String(value))).join(' ');
        argsOutput = await this.queueGdbCommand(session, `set args ${quotedArgs}`);
      }

      return textResult(
        `Program loaded: ${normalizedPath}\n\nOutput:\n${loadOutput}${argsOutput ? `\n${argsOutput}` : ''}`
      );
    } catch (error) {
      return errorResult(`Failed to load program: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async handleGdbCommand(args) {
    const { sessionId, command } = args;
    return this.runSessionCommand(sessionId, command, `Command: ${command}`, 'Failed to execute command');
  }

  async handleGdbConnect(args) {
    const { sessionId, target, extendedRemote = false } = args;
    const command = `${extendedRemote ? 'target extended-remote' : 'target remote'} ${target}`;
    return this.runSessionCommand(sessionId, command, `Connected to ${target}`, 'Failed to connect to target');
  }

  async handleGdbReadRegister(args) {
    const { sessionId, register } = args;
    return this.runSessionCommand(
      sessionId,
      `info registers ${register}`,
      `Register ${register}:`,
      `Failed to read register ${register}`
    );
  }

  async handleGdbReadMemory(args) {
    const { sessionId, address, format = 'wx', count = 1 } = args;
    return this.runSessionCommand(
      sessionId,
      `x/${count}${format} ${address}`,
      `Memory ${address} (${count}${format}):`,
      `Failed to read memory at ${address}`
    );
  }

  async handleGdbTerminate(args) {
    const { sessionId } = args;
    if (!this.getSession(sessionId)) {
      return errorResult(`No active GDB session with ID: ${sessionId}`);
    }

    try {
      await this.terminateGdbSession(sessionId);
      return textResult(`GDB session terminated: ${sessionId}`);
    } catch (error) {
      return errorResult(
        `Failed to terminate GDB session: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async handleGdbListSessions() {
    const sessions = Array.from(activeSessions.values()).map((session) => ({
      id: session.id,
      target: session.target || 'No program loaded',
      workingDir: session.workingDir || process.cwd(),
    }));

    return textResult(`Active GDB Sessions (${sessions.length}):\n\n${JSON.stringify(sessions, null, 2)}`);
  }

  async handleGdbAttach(args) {
    const { sessionId, pid } = args;
    return this.runSessionCommand(sessionId, `attach ${pid}`, `Attached to process ${pid}`, 'Failed to attach');
  }

  async handleGdbLoadCore(args) {
    const { sessionId, program, corePath } = args;
    const resolved = this.getSessionOrError(sessionId);
    if (!resolved.session) {
      return resolved.response;
    }

    const session = resolved.session;

    try {
      const normalizedProgram =
        session.workingDir && !path.isAbsolute(program)
          ? path.resolve(session.workingDir, program)
          : program;
      const normalizedCore =
        session.workingDir && !path.isAbsolute(corePath)
          ? path.resolve(session.workingDir, corePath)
          : corePath;

      const fileOutput = await this.queueGdbCommand(session, `file "${normalizedProgram}"`);
      const coreOutput = await this.queueGdbCommand(session, `core-file "${normalizedCore}"`);
      const backtraceOutput = await this.queueGdbCommand(session, 'backtrace');

      return textResult(
        `Core file loaded: ${normalizedCore}\n\nOutput:\n${fileOutput}\n${coreOutput}\n\nBacktrace:\n${backtraceOutput}`
      );
    } catch (error) {
      return errorResult(`Failed to load core file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async handleGdbSetBreakpoint(args) {
    const { sessionId, location, condition } = args;
    const resolved = this.getSessionOrError(sessionId);
    if (!resolved.session) {
      return resolved.response;
    }

    const session = resolved.session;

    try {
      const output = await this.queueGdbCommand(session, `break ${location}`);
      let conditionOutput = '';
      if (condition) {
        const match = output.match(/Breakpoint (\d+)/);
        if (match && match[1]) {
          conditionOutput = await this.queueGdbCommand(session, `condition ${match[1]} ${condition}`);
        }
      }

      return textResult(
        `Breakpoint set at: ${location}${condition ? ` with condition: ${condition}` : ''}\n\nOutput:\n${output}${
          conditionOutput ? `\n${conditionOutput}` : ''
        }`
      );
    } catch (error) {
      return errorResult(`Failed to set breakpoint: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async handleGdbContinue(args) {
    return this.runSessionCommand(args.sessionId, 'continue', 'Continued execution', 'Failed to continue');
  }

  async handleGdbStep(args) {
    const command = args.instructions ? 'stepi' : 'step';
    return this.runSessionCommand(
      args.sessionId,
      command,
      `Stepped ${args.instructions ? 'instruction' : 'line'}`,
      'Failed to step'
    );
  }

  async handleGdbNext(args) {
    const command = args.instructions ? 'nexti' : 'next';
    return this.runSessionCommand(
      args.sessionId,
      command,
      `Stepped over ${args.instructions ? 'instruction' : 'function call'}`,
      'Failed to step over'
    );
  }

  async handleGdbFinish(args) {
    return this.runSessionCommand(args.sessionId, 'finish', 'Finished current function', 'Failed to finish function');
  }

  async handleGdbBacktrace(args) {
    let command = args.full ? 'backtrace full' : 'backtrace';
    if (typeof args.limit === 'number') {
      command += ` ${args.limit}`;
    }
    return this.runSessionCommand(args.sessionId, command, 'Backtrace:', 'Failed to get backtrace');
  }

  async handleGdbPrint(args) {
    return this.runSessionCommand(
      args.sessionId,
      `print ${args.expression}`,
      `Print ${args.expression}:`,
      'Failed to print expression'
    );
  }

  async handleGdbExamine(args) {
    const command = `x/${args.count || 1}${args.format || 'x'} ${args.expression}`;
    return this.runSessionCommand(
      args.sessionId,
      command,
      `Examine ${args.expression} (format: ${args.format || 'x'}, count: ${args.count || 1}):`,
      'Failed to examine memory'
    );
  }

  async handleGdbInfoRegisters(args) {
    const command = args.register ? `info registers ${args.register}` : 'info registers';
    return this.runSessionCommand(
      args.sessionId,
      command,
      `Register info${args.register ? ` for ${args.register}` : ''}:`,
      'Failed to get register info'
    );
  }

  async handleGdbListSource(args) {
    const { sessionId, location } = args;
    const resolved = this.getSessionOrError(sessionId);
    if (!resolved.session) {
      return resolved.response;
    }

    const session = resolved.session;
    const command = location ? `list ${location}` : 'list';

    try {
      const output = await this.queueGdbCommand(session, command);
      const sourceInfo = await this.parseSourceInfoFromGdbOutput(session, output);

      if (!sourceInfo.filePath) {
        return textResult(`Source code ${location ? `at ${location}` : 'at current location'}:\n\n${output}`);
      }

      return {
        debug: {
          sourceInfo,
        },
        content: [
          {
            type: 'text',
            text: `Source code ${location ? `at ${location}` : 'at current location'}:\n\n${output}`,
          },
          {
            type: 'source_location',
            filePath: sourceInfo.filePath,
            lineStart: sourceInfo.lineStart,
            lineEnd: sourceInfo.lineEnd,
            currentLine: sourceInfo.currentLine,
            vscodeUri: `vscode://file${sourceInfo.filePath}:${sourceInfo.lineStart}`,
          },
        ],
      };
    } catch (error) {
      return errorResult(`Failed to list source: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async runSessionCommand(sessionId, command, successLabel, errorLabel) {
    const resolved = this.getSessionOrError(sessionId);
    if (!resolved.session) {
      return resolved.response;
    }

    try {
      const output = await this.queueGdbCommand(resolved.session, command);
      return textResult(`${successLabel}\n\n${output}`);
    } catch (error) {
      return errorResult(`${errorLabel}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async parseSourceInfoFromGdbOutput(session, output) {
    const defaultResult = { filePath: '', lineStart: 0, lineEnd: 0, currentLine: 0 };
    if (!output.trim()) {
      return defaultResult;
    }

    try {
      const infoLineOutput = await this.queueGdbCommand(session, 'info line');
      const infoLineMatch = infoLineOutput.match(/Line (\d+) of "([^"]+)"/);

      let filePath = '';
      let currentLine = 0;

      if (infoLineMatch) {
        currentLine = Number.parseInt(infoLineMatch[1], 10);
        filePath = infoLineMatch[2];
      } else {
        const infoOutput = await this.queueGdbCommand(session, 'info source');
        const filePathMatch = infoOutput.match(/Current source file is (.*?)(?: |$)/);
        filePath = filePathMatch ? filePathMatch[1] : '';
      }

      const lines = output.split('\n').filter((line) => line.trim());
      const sourceLines = lines.filter((line) => /^\s*\d+\s+/.test(line));

      if (sourceLines.length === 0) {
        return defaultResult;
      }

      const firstLineMatch = sourceLines[0].match(/^\s*(\d+)\s+/);
      const lastLineMatch = sourceLines[sourceLines.length - 1].match(/^\s*(\d+)\s+/);

      if (firstLineMatch && lastLineMatch) {
        return {
          filePath,
          lineStart: Number.parseInt(firstLineMatch[1], 10),
          lineEnd: Number.parseInt(lastLineMatch[1], 10),
          currentLine,
        };
      }
    } catch {
      return defaultResult;
    }

    return defaultResult;
  }

  runGdbCommand(session, command) {
    return new Promise((resolve, reject) => {
      if (!session.ready) {
        reject(new Error('GDB session is not ready'));
        return;
      }

      const escapedCommand = this.escapeMiString(command);
      session.process.stdin.write(`-interpreter-exec console "${escapedCommand}"\n`);

      let output = '';
      let settled = false;

      const onLine = (line) => {
        if (line.trim() === '(gdb)') {
          return;
        }

        if (line.startsWith('^done')) {
          settle(resolve, output.trim() || '(ok)');
          return;
        }

        if (line.startsWith('^error')) {
          const errorText = this.extractMiError(line);
          settle(reject, new Error([output.trim(), errorText].filter(Boolean).join('\n')));
          return;
        }

        if (line.startsWith('^running')) {
          settle(resolve, output.trim() || '^running');
          return;
        }

        const decodedLine = this.decodeMiOutputLine(line);
        if (decodedLine.trim()) {
          output += decodedLine.endsWith('\n') ? decodedLine : `${decodedLine}\n`;
        }
      };

      const onStderr = (data) => {
        const errorText = data.toString();
        output += `[stderr] ${errorText}${errorText.endsWith('\n') ? '' : '\n'}`;
      };

      const onExit = (code, signal) => {
        settle(reject, new Error(`GDB process exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'null'})`));
      };

      const timeout = setTimeout(() => {
        settle(reject, new Error(`GDB command timed out: ${command}`));
      }, 10000);
      timeout.unref();

      const cleanup = () => {
        clearTimeout(timeout);
        session.rl.removeListener('line', onLine);
        session.process.stderr.removeListener('data', onStderr);
        session.process.removeListener('exit', onExit);
      };

      const settle = (callback, value) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        callback(value);
      };

      session.rl.on('line', onLine);
      session.process.stderr.on('data', onStderr);
      session.process.on('exit', onExit);
    });
  }

  escapeMiString(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  decodeMiString(value) {
    try {
      return JSON.parse(`"${value}"`);
    } catch {
      return value;
    }
  }

  decodeMiOutputLine(line) {
    const match = line.match(/^[~@&]"(.*)"$/);
    if (!match) {
      return line;
    }
    return this.decodeMiString(match[1]);
  }

  extractMiError(line) {
    const match = line.match(/msg="((?:[^"\\]|\\.)*)"/);
    return match ? this.decodeMiString(match[1]) : line;
  }

  async terminateGdbSession(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`No active GDB session with ID: ${sessionId}`);
    }

    session.process.stdin.write('-gdb-exit\n');

    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 1000);
      session.process.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    if (!session.process.killed) {
      session.process.kill();
    }

    session.rl.close();
    activeSessions.delete(sessionId);
  }

  async shutdown() {
    for (const sessionId of Array.from(activeSessions.keys())) {
      try {
        await this.terminateGdbSession(sessionId);
      } catch (error) {
        console.error('[MCP Error] Failed to terminate session during shutdown:', error);
      }
    }
  }
}

const server = new GdbServer();
server.run().catch((error) => {
  console.error('Failed to start GDB MCP server:', error);
  process.exit(1);
});
