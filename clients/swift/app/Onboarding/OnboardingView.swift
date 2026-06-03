import SwiftUI
import PhotosUI

/// First-run profile creation. Shown only when the account is not yet onboarded.
/// Pick a unique @handle (checked live) and an optional avatar, then enter the app.
struct OnboardingView: View {
    @EnvironmentObject private var model: AppModel

    @State private var handle = ""
    @State private var availability: UsernameAvailability?
    @State private var checking = false
    @State private var photoItem: PhotosPickerItem?
    @State private var avatarData: Data?
    @State private var submitting = false
    @State private var error: String?

    private var canSubmit: Bool {
        (availability?.available ?? false) && !submitting
    }

    var body: some View {
        VStack(spacing: 24) {
            Text("Create your profile").font(.title.bold())

            // Avatar
            PhotosPicker(selection: $photoItem, matching: .images) {
                ZStack {
                    Circle().fill(.gray.opacity(0.2)).frame(width: 110, height: 110)
                    if let data = avatarData, let img = UIImage(data: data) {
                        Image(uiImage: img).resizable().scaledToFill()
                            .frame(width: 110, height: 110).clipShape(Circle())
                    } else {
                        Image(systemName: "camera.fill").font(.title).foregroundStyle(.secondary)
                    }
                }
            }
            .onChange(of: photoItem) { _, item in
                Task { avatarData = try? await item?.loadTransferable(type: Data.self) }
            }

            // Handle
            VStack(alignment: .leading, spacing: 6) {
                TextField("@username", text: $handle)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)
                    .onChange(of: handle) { _, _ in scheduleCheck() }
                if checking {
                    Text("Checking…").font(.footnote).foregroundStyle(.secondary)
                } else if let a = availability {
                    Text(a.available ? "✓ Available" : (a.reason ?? "Unavailable"))
                        .font(.footnote)
                        .foregroundStyle(a.available ? .green : .red)
                }
            }

            if let error { Text(error).foregroundStyle(.red).font(.footnote) }

            Button(action: { Task { await finish() } }) {
                if submitting { ProgressView() } else { Text("Enter Whoosh").bold() }
            }
            .buttonStyle(.borderedProminent)
            .disabled(!canSubmit)

            Button("Sign out") { Task { await model.signOut() } }
                .font(.footnote).foregroundStyle(.secondary)
        }
        .padding(24)
    }

    /// Debounced availability check (~400ms after the last keystroke).
    @State private var checkTask: Task<Void, Never>?
    private func scheduleCheck() {
        checkTask?.cancel()
        availability = nil
        let candidate = handle
        guard !candidate.isEmpty else { return }
        checking = true
        checkTask = Task {
            try? await Task.sleep(nanoseconds: 400_000_000)
            if Task.isCancelled { return }
            defer { checking = false }
            availability = try? await model.api.usernameAvailable(candidate)
        }
    }

    private func finish() async {
        submitting = true; error = nil
        defer { submitting = false }
        do {
            if let data = avatarData {
                _ = try await model.api.uploadAvatar(imageData: data)
            }
            _ = try await model.api.setUsername(handle)
            model.didFinishOnboarding()
        } catch let e as APIError {
            error = e.message            // e.g. "That handle is taken." on conflict
        } catch {
            self.error = error.localizedDescription
        }
    }
}
