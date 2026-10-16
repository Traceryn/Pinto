module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src/_test_"],
  testMatch: ["**/*.test.ts"],
  testPathIgnorePatterns: ["<rootDir>/lib/"],
  moduleFileExtensions: ["ts", "js", "json"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.[tj]sx?$": [
      "ts-jest",
      {
        tsconfig: {
          module: "CommonJS",
          moduleResolution: "Node",
          isolatedModules: true,
        },
      },
    ],
  },
  clearMocks: true,
  verbose: true,
};
