package com.margelo.nitro.continuedtask
  
import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
class ContinuedTask : HybridContinuedTaskSpec() {
  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }
}
