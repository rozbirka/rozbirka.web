import contextlib
import importlib.util
import io
import os
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

class DeliveryTests(unittest.TestCase):
    def setUp(self):
        path=Path(__file__).with_name('provision-prod-auth-key.py')
        spec=importlib.util.spec_from_file_location('delivery',path)
        self.m=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.m)
        self.key='synthetic-key-for-tests-only-0123456789'
        self.calls=[]
    def api(self, method, payload=None):
        self.calls.append((method,payload))
        ready=any(m in ('PUT','PATCH') for m,_ in self.calls)
        if self.m.KIND=='web':return [{'name':self.m.BINDING,'type':'secret_text'}] if ready else []
        return {'name':self.m.TARGET,'deployment_configs':{'production':{'env_vars':{self.m.BINDING:{'type':'secret_text'}} if ready else {}}}}
    def run_main(self,secret=None,api=None,account=None):
        out=io.StringIO()
        with patch.dict(os.environ,{'CLOUDFLARE_ACCOUNT_ID':account or self.m.ACCOUNT,'CLOUDFLARE_API_TOKEN':'synthetic-test-token'}),patch.object(self.m,'api',side_effect=api or self.api),patch.object(self.m.subprocess,'run',return_value=subprocess.CompletedProcess([],0,(self.key if secret is None else secret).encode(),b'')) as read,contextlib.redirect_stdout(out):
            status=self.m.main()
        return status,out.getvalue(),read
    def test_delivers_only_to_reviewed_server_binding(self):
        status,_,read=self.run_main();self.assertEqual(status,0)
        self.assertEqual([m for m,_ in self.calls],['GET',self.m.METHOD,'GET'])
        self.assertNotIn(self.key,' '.join(read.call_args.args[0]))
        self.assertIn('--project=rozbirka-prod',read.call_args.args[0])
        self.assertIn(self.key,str(self.calls[1][1]))
        self.assertNotIn('preview',str(self.calls[1][1]))
    def test_wrong_account_rejected_before_secret_read(self):
        status,_,read=self.run_main(account='wrong');self.assertEqual(status,1);read.assert_not_called();self.assertEqual(self.calls,[])
    def test_empty_secret_cannot_overwrite_binding(self):
        status,_,_=self.run_main(secret='');self.assertEqual(status,1);self.assertEqual([m for m,_ in self.calls],['GET'])
    def test_provider_exception_never_prints_payload(self):
        def fail(method,payload=None):raise RuntimeError(self.key)
        status,out,read=self.run_main(api=fail);self.assertEqual(status,1);self.assertNotIn(self.key,out);read.assert_not_called()

if __name__=='__main__':unittest.main()
