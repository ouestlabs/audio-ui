#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include "dsp-abi.h"
// 4 s through the compiled processor: a tone, ducked by a burst every 250 ms, switched off for the third second.
int main(void) {
  dsp_init();
  Dsp* d = dsp_create(128, 48000);
  dsp_start(d);
  for (long block = 0; block < 1500; block++) {
    for (int i = 0; i < 128; i++) {
      long at = block * 128 + i;
      float sound = (float)(0.3 * sin(2 * M_PI * 440 * at / 48000.0));
      float key = (float)(((at % 12000) < 3000 ? 0.9 : 0.0) * ((at / 24) % 2 ? 1 : -1));
      for (int c = 0; c < 2; c++) { dsp_input(d, 0, c)[i] = sound; dsp_input(d, 1, c)[i] = key; }
    }
    dsp_set_bool(d, 0, !(block >= 750 && block < 1125));
    dsp_process(d, 128);
    fwrite(dsp_output(d, 0, 0), sizeof(float), 128, stdout);
  }
  int failed = dsp_failed(d);
  dsp_destroy(d); dsp_shutdown();
  return failed;
}
