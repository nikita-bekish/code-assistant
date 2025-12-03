"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var index_js_1 = require("./dist/src/index.js");
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var config, assistant, questions, i, question, result, error_1, msg, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    config = {
                        projectName: 'Test Project',
                        projectDescription: 'Testing CRM tools',
                        paths: {
                            root: process.cwd(),
                            output: '.code-assistant',
                            git: '.git',
                        },
                        indexing: {
                            includeFolders: ['src'],
                            excludeFolders: ['.claude', 'node_modules', 'dist'],
                            includeFileTypes: ['.ts', '.tsx'],
                            excludePatterns: ['*.test.ts'],
                            maxFileSize: '10MB',
                            chunkSize: 400,
                            chunkOverlap: 100,
                        },
                        git: {
                            enabled: true,
                            includeCommitHistory: true,
                            maxCommitsToFetch: 50,
                        },
                        llm: {
                            model: 'llama3.2',
                            temperature: 0.2,
                            topP: 0.8,
                            contextWindow: 4096,
                            maxResults: 5,
                        },
                        prompt: {
                            system: 'You are a helpful code assistant for {projectName}. Help developers understand the codebase, explain architecture, suggest implementations. Always cite sources.',
                            language: 'en',
                        },
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 9, , 10]);
                    assistant = new index_js_1.CodeAssistant(config);
                    return [4 /*yield*/, assistant.initialize()];
                case 2:
                    _a.sent();
                    console.log('✅ Assistant initialized\n');
                    questions = [
                        'Get information about user user_1',
                        'List all tickets for user user_1',
                        'Search for tickets about authentication',
                    ];
                    i = 0;
                    _a.label = 3;
                case 3:
                    if (!(i < questions.length)) return [3 /*break*/, 8];
                    question = questions[i];
                    console.log("\n\uD83D\uDCDD Q".concat(i + 1, ": \"").concat(question, "\""));
                    console.log('-'.repeat(60));
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, assistant.ask(question)];
                case 5:
                    result = _a.sent();
                    console.log("Answer: ".concat(result.answer.substring(0, 200), "..."));
                    console.log("Sources: ".concat(result.sources.length, " found, Confidence: ").concat((result.confidence * 100).toFixed(0), "%"));
                    return [3 /*break*/, 7];
                case 6:
                    error_1 = _a.sent();
                    msg = error_1 instanceof Error ? error_1.message : String(error_1);
                    console.error("Error: ".concat(msg));
                    return [3 /*break*/, 7];
                case 7:
                    i++;
                    return [3 /*break*/, 3];
                case 8:
                    process.exit(0);
                    return [3 /*break*/, 10];
                case 9:
                    error_2 = _a.sent();
                    console.error('Failed to initialize assistant:', error_2);
                    process.exit(1);
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/];
            }
        });
    });
}
main();
