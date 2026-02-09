
/**
 * Compares two semantic version strings.
 * Returns:
 * - 1 if v1 > v2
 * - -1 if v1 < v2
 * - 0 if v1 === v2
 */
export function compareVersions(v1, v2) {
    const p1 = v1.replace(/^[vV^~]/, '').split('.').map(Number);
    const p2 = v2.replace(/^[vV^~]/, '').split('.').map(Number);

    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const n1 = p1[i] || 0;
        const n2 = p2[i] || 0;
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
    }
    return 0;
}

/**
 * Checks for updates from the GitHub repository.
 * @returns {Promise<{
 *   hasUpdate: boolean,
 *   latestVersion: string,
 *   currentVersion: string,
 *   releaseUrl: string,
 *   error?: string
 * }>}
 */
export async function checkUpdate() {
    try {
        const manifest = chrome.runtime.getManifest();
        const currentVersion = manifest.version;

        const response = await fetch('https://api.github.com/repos/jeffpeng3/HoneyWhisper/releases/latest');
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        const data = await response.json();
        const latestVersion = data.tag_name;

        const comparison = compareVersions(latestVersion, currentVersion);

        return {
            hasUpdate: comparison > 0,
            latestVersion,
            currentVersion,
            releaseUrl: data.html_url
        };
    } catch (error) {
        console.error('Update check failed:', error);
        return {
            hasUpdate: false,
            latestVersion: '0.0.0',
            currentVersion: chrome.runtime.getManifest().version,
            releaseUrl: '',
            error: error.message
        };
    }
}
