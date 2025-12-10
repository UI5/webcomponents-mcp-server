export default {
	extensions: {
		ts: "module",
	},
	files: [
		"test/**/*.test.ts",
	],
	watchMode: {
		ignoreChanges: [
			"build/**",
			"node_modules/**",
			".history/**",
			".tsimp/**",
		],
	},
	nodeArguments: [
        "--import=tsx/esm",
        "--no-warnings=ExperimentalWarning",
    ],
	workerThreads: false,
	timeout: "20s", // Increased timeout for slower CI environments
};