"""Deliver one explicitly authorized existing production key; never log payloads."""
import json
import os
import subprocess
import urllib.request

ACCOUNT = '22a32b350711ff6b9b27d29f8a93eb6d'
KIND = 'web'
TARGET = 'rozbirka-pro-web'
SECRET = 'core-registration-key'
BINDING = 'AUTH_REGISTRATION_KEY'
METHOD = 'PUT' if KIND == 'web' else 'PATCH'
RESOURCE = '/workers/scripts/' + TARGET + '/secrets' if KIND == 'web' else '/pages/projects/' + TARGET


def api(method, payload=None):
    request = urllib.request.Request(
        'https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT + RESOURCE,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={'Authorization': 'Bearer ' + os.environ['CLOUDFLARE_API_TOKEN'], 'Content-Type': 'application/json'},
        method=method)
    with urllib.request.urlopen(request, timeout=30) as response:
        result = json.load(response)
    if result.get('success') is not True:
        raise RuntimeError('Provider rejected operation')
    return result['result']


def main():
    stage = 'destination-validation'
    try:
        if os.environ.get('CLOUDFLARE_ACCOUNT_ID') != ACCOUNT or not os.environ.get('CLOUDFLARE_API_TOKEN'):
            raise RuntimeError('Destination configuration mismatch')
        before = api('GET')  # Fail if the approved Worker/Pages project does not exist.
        if (KIND == 'web' and not isinstance(before, list)) or (KIND == 'admin' and before.get('name') != TARGET):
            raise RuntimeError('Target mismatch')
        stage = 'source-read'
        source = subprocess.run(['gcloud', 'secrets', 'versions', 'access', '1', '--secret=' + SECRET, '--project=rozbirka-prod'], capture_output=True, check=False)
        if source.returncode != 0 or not 32 <= len(source.stdout.strip()) <= 512:
            raise RuntimeError('Missing or invalid source key')
        value = source.stdout.decode().strip()
        payload = {'name': BINDING, 'text': value, 'type': 'secret_text'} if KIND == 'web' else {
            'deployment_configs': {'production': {'env_vars': {BINDING: {'value': value, 'type': 'secret_text'}}}}}
        stage = 'server-binding-write'
        api(METHOD, payload)
        stage = 'binding-metadata-verification'
        after = api('GET')
        if KIND == 'web':
            verified = any(item.get('name') == BINDING and item.get('type') == 'secret_text' for item in after)
        else:
            verified = after.get('name') == TARGET and after['deployment_configs']['production']['env_vars'].get(BINDING, {}).get('type') == 'secret_text'
        if not verified:
            raise RuntimeError('Binding metadata not verified')
        print('Production server binding verified: ' + TARGET + '/' + BINDING)
        return 0
    except Exception:
        # Provider exceptions may include request data. Do not print them or response bodies.
        print('Production key delivery failed at fixed stage: ' + stage)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
