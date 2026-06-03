// swift-tools-version:5.9
//
// Snippet for the future iOS/SwiftUI repo. It wires Apple's swift-openapi-generator
// as a build plugin that turns `openapi/whoosh-v1.yaml` into a type-safe `Client`
// at build time. Copy this into the SwiftUI package (adjust the target/paths) and
// vendor the spec (or add it as a package resource / git submodule of this repo).
import PackageDescription

let package = Package(
    name: "WhooshAPI",
    platforms: [.iOS(.v16)],
    products: [
        .library(name: "WhooshAPI", targets: ["WhooshAPI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-openapi-generator", from: "1.0.0"),
        .package(url: "https://github.com/apple/swift-openapi-runtime", from: "1.0.0"),
        .package(url: "https://github.com/apple/swift-openapi-urlsession", from: "1.0.0"),
    ],
    targets: [
        .target(
            name: "WhooshAPI",
            dependencies: [
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
                .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession"),
            ],
            // Place `whoosh-v1.yaml` (renamed `openapi.yaml`) and
            // `openapi-generator-config.yaml` in this target's source dir.
            plugins: [
                .plugin(name: "OpenAPIGenerator", package: "swift-openapi-generator"),
            ]
        ),
    ]
)
