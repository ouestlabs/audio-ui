// A minimal VST3 host for the built bundle: its sidechain bus and its saved state.
#include "vst3.h"
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <dlfcn.h>
#include <vector>
#include <algorithm>
using namespace Steinberg;
using namespace Steinberg::Vst;

struct Stream : IBStream {
  std::vector<char> data; size_t at = 0;
  tresult queryInterface(const TUID, void**) override { return kResultFalse; }
  uint32 addRef() override { return 1; }
  uint32 release() override { return 1; }
  tresult read(void* b, int32 n, int32* got) override { int32 c = (int32)std::min((size_t)n, data.size() - at); memcpy(b, data.data() + at, c); at += c; if (got) *got = c; return kResultOk; }
  tresult write(void* b, int32 n, int32* wrote) override { data.insert(data.end(), (char*)b, (char*)b + n); if (wrote) *wrote = n; return kResultOk; }
  tresult seek(int64, int32, int64*) override { return kNotImplemented; }
  tresult tell(int64*) override { return kNotImplemented; }
};
struct Queue : IParamValueQueue {
  ParamID id; double value;
  tresult queryInterface(const TUID, void**) override { return kResultFalse; }
  uint32 addRef() override { return 1; }
  uint32 release() override { return 1; }
  ParamID getParameterId() override { return id; }
  int32 getPointCount() override { return 1; }
  tresult getPoint(int32, int32& o, ParamValue& v) override { o = 0; v = value; return kResultOk; }
  tresult addPoint(int32, ParamValue, int32&) override { return kNotImplemented; }
};
struct Changes : IParameterChanges {
  std::vector<Queue> queues;
  tresult queryInterface(const TUID, void**) override { return kResultFalse; }
  uint32 addRef() override { return 1; }
  uint32 release() override { return 1; }
  int32 getParameterCount() override { return (int32)queues.size(); }
  IParamValueQueue* getParameterData(int32 i) override { return &queues[i]; }
  IParamValueQueue* addParameterData(const ParamID&, int32&) override { return nullptr; }
};
#define CHECK(x) do { if (!(x)) { printf("FAILED: %s\n", #x); exit(1); } } while (0)

struct Instance {
  IComponent* component = nullptr; IAudioProcessor* processor = nullptr; IEditController* controller = nullptr;
  Instance(IPluginFactory* f) {
    PClassInfo info; CHECK(f->getClassInfo(0, &info) == kResultOk);
    TUID id; make_tuid(id, UID_IComponent, false);
    CHECK(f->createInstance(info.cid, id, (void**)&component) == kResultOk);
    CHECK(component->initialize(nullptr) == kResultOk);
    CHECK(qi((IComponent*)component, UID_IAudioProcessor, (void**)&processor) == kResultOk);
    CHECK(qi((IComponent*)component, UID_IEditController, (void**)&controller) == kResultOk);
  }
  void start(bool keyed) {
    uint64 in[2] = {3, 3}, out[1] = {3};
    CHECK(processor->setBusArrangements(in, 2, out, 1) == kResultOk);
    CHECK(component->activateBus(kAudio, kInput, 1, keyed) == kResultOk);
    ProcessSetup setup{kRealtime, kSample32, 512, 48000};
    CHECK(processor->setupProcessing(setup) == kResultOk);
    CHECK(component->setActive(true) == kResultOk);
    processor->setProcessing(true);
  }
  // 1 s of a steady tone; the key is a loud square in the first half second only. Returns the output.
  std::vector<float> render(bool keyed, Changes* first = nullptr) {
    std::vector<float> all;
    float a[2][512], k[2][512], o[2][512];
    float* ap[2] = {a[0], a[1]}; float* kp[2] = {k[0], k[1]}; float* op[2] = {o[0], o[1]};
    for (int block = 0; block < 94; block++) {
      for (int i = 0; i < 512; i++) {
        long at = block * 512L + i;
        a[0][i] = a[1][i] = (float)(0.02 * sin(2 * M_PI * 440 * at / 48000.0));
        k[0][i] = k[1][i] = at < 24000 ? ((at / 24) % 2 ? 0.9f : -0.9f) : 0.f;
      }
      AudioBusBuffers ins[2] = {{2, 0, {ap}}, {2, 0, {kp}}}, outs[1] = {{2, 0, {op}}};
      ProcessData d{}; d.symbolicSampleSize = kSample32; d.numSamples = 512; d.numInputs = keyed ? 2 : 1; d.numOutputs = 1; d.inputs = ins; d.outputs = outs;
      if (block == 0) d.inputParameterChanges = first;
      CHECK(processor->process(d) == kResultOk);
      all.insert(all.end(), o[0], o[0] + 512);
    }
    return all;
  }
};
// The peak of a stretch, in dB against the tone's own 0.02.
static double gainDb(const std::vector<float>& x, int from, int to) { float p = 0; for (int i = from; i < to; i++) p = std::max(p, std::fabs(x[i])); return 20 * log10(p / 0.02); }

int main(int, char** argv) {
  void* lib = dlopen(argv[1], RTLD_NOW); CHECK(lib);
  CHECK(((bool (*)(void*))dlsym(lib, "bundleEntry"))(lib));
  IPluginFactory* f = ((IPluginFactory * (*)()) dlsym(lib, "GetPluginFactory"))();

  { Instance p(f); p.start(true); auto x = p.render(true);
    printf("sidechain on:  key playing %+.2f dB, key silent %+.2f dB\n", gainDb(x, 12000, 24000), gainDb(x, 43000, 48000));
    CHECK(gainDb(x, 12000, 24000) < -15 && gainDb(x, 43000, 48000) > gainDb(x, 12000, 24000)); }
  { Instance p(f); p.start(false); auto x = p.render(false);
    printf("sidechain off: (keys itself, quiet tone) %+.2f dB\n", gainDb(x, 12000, 24000)); }

  // Changed values, as a host sends them, then saved and given to a new instance.
  Instance p(f); const int n = p.controller->getParameterCount();
  Changes changes; const double wanted[7] = {1, 0.25, 0.8, 0.5, 0.6, 0.1, 0.2};
  std::vector<ParameterInfo> infos(n);
  for (int i = 0; i < n; i++) { p.controller->getParameterInfo(i, infos[i]); Queue q; q.id = infos[i].id; q.value = wanted[i]; changes.queues.push_back(q); }
  p.start(true); auto before = p.render(true, &changes);
  Stream saved; CHECK(p.component->getState(&saved) == kResultOk);
  Instance r(f); CHECK(r.component->setState(&saved) == kResultOk); r.start(true);
  printf("saved state: %zu bytes\n", saved.data.size());
  for (int i = 0; i < n; i++) {
    char name[64] = {0}; for (int c = 0; c < 63 && infos[i].title[c]; c++) name[c] = (char)infos[i].title[c];
    double v = r.controller->getParamNormalized(infos[i].id);
    CHECK(std::fabs(v - wanted[i]) < 0.001);
    printf("  %-12s asked %.3f restored %.3f -> %g\n", name, wanted[i], v, r.controller->normalizedParamToPlain(infos[i].id, v));
  }
  Stream again; CHECK(r.component->getState(&again) == kResultOk);
  auto after = r.render(true);
  float worst = 0; for (size_t i = 0; i < after.size(); i++) worst = std::max(worst, std::fabs(after[i] - before[i]));
  printf("resaved state identical: %s, largest output difference after restore: %g\n", again.data == saved.data ? "yes" : "no", worst);
  // The bytes differ: plugin-vst 0.0.2 saves a value off its step and a restored instance snaps it.
  CHECK(worst == 0);
  return 0;
}
