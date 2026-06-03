import SwiftUI
import AuthenticationServices
import CryptoKit

/// First screen for signed-out users. Email/password + Sign in with Apple.
/// (Including Sign in with Apple satisfies App Store Guideline 4.8; Discord is
/// linked later from Settings.)
struct AuthView: View {
    @EnvironmentObject private var model: AppModel

    @State private var email = ""
    @State private var password = ""
    @State private var isSignUp = false
    @State private var busy = false
    @State private var error: String?
    @State private var note: String?
    /// Raw nonce kept between issuing the Apple request and verifying its token.
    @State private var appleNonce = ""

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            Text("Whoosh").font(.largeTitle.bold())
            Text(isSignUp ? "Create your account" : "Welcome back")
                .foregroundStyle(.secondary)

            VStack(spacing: 12) {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                SecureField("Password", text: $password)
                    .textContentType(isSignUp ? .newPassword : .password)
            }
            .textFieldStyle(.roundedBorder)

            if let error { Text(error).foregroundStyle(.red).font(.footnote) }
            if let note { Text(note).foregroundStyle(.secondary).font(.footnote) }

            Button(action: { Task { await submitEmail() } }) {
                if busy { ProgressView() } else { Text(isSignUp ? "Sign up" : "Sign in").bold() }
            }
            .buttonStyle(.borderedProminent)
            .disabled(busy || email.isEmpty || password.isEmpty)

            Button(isSignUp ? "Have an account? Sign in" : "New here? Create an account") {
                isSignUp.toggle(); error = nil; note = nil
            }
            .font(.footnote)

            SignInWithAppleButton(.signIn, onRequest: configureApple, onCompletion: handleApple)
                .signInWithAppleButtonStyle(.black)
                .frame(height: 48)
                .padding(.top, 8)

            Spacer()
        }
        .padding(24)
    }

    // MARK: Email

    private func submitEmail() async {
        busy = true; error = nil; note = nil
        defer { busy = false }
        do {
            if isSignUp {
                let active = try await model.auth.signUpEmail(email, password: password)
                guard active else { note = "Check your email to confirm, then sign in."; isSignUp = false; return }
            } else {
                try await model.auth.signInEmail(email, password: password)
            }
            await model.didAuthenticate()
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: Apple

    private func configureApple(_ request: ASAuthorizationAppleIDRequest) {
        appleNonce = Self.randomNonce()
        request.requestedScopes = [.fullName, .email]
        request.nonce = Self.sha256(appleNonce)
    }

    private func handleApple(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .failure(let e):
            error = e.localizedDescription
        case .success(let auth):
            guard
                let cred = auth.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = cred.identityToken,
                let idToken = String(data: tokenData, encoding: .utf8)
            else { error = "Could not read Apple credential."; return }
            Task {
                busy = true; defer { busy = false }
                do {
                    try await model.auth.signInWithApple(idToken: idToken, nonce: appleNonce)
                    await model.didAuthenticate()
                } catch { self.error = error.localizedDescription }
            }
        }
    }

    // MARK: Nonce helpers (Apple requires a hashed nonce)

    private static func randomNonce(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remaining = length
        while remaining > 0 {
            var random: UInt8 = 0
            _ = SecRandomCopyBytes(kSecRandomDefault, 1, &random)
            if random < charset.count { result.append(charset[Int(random)]); remaining -= 1 }
        }
        return result
    }

    private static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
