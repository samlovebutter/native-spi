CC_X64 ?= gcc
CC_ARM64 ?= aarch64-linux-gnu-gcc
CC_ARMHF ?= arm-linux-gnueabihf-gcc

CFLAGS ?= -std=c11 -O2 -fPIC -Wall -Wextra -Werror
SOFLAGS ?= -shared

SOURCE := spi_bindings/spi_binding.c
HEADER := spi_bindings/spi_binding.h
LIB_DIR := spi_bindings/libs

LIB_X64 := $(LIB_DIR)/libspi-x64.so
LIB_ARM64 := $(LIB_DIR)/libspi-aarch64.so
LIB_ARMHF := $(LIB_DIR)/libspi-armhf.so
LIBRARIES := $(LIB_X64) $(LIB_ARM64) $(LIB_ARMHF)

.PHONY: all verify clean

all: $(LIBRARIES)

$(LIB_DIR):
	mkdir -p $@

$(LIB_X64): $(SOURCE) $(HEADER) | $(LIB_DIR)
	$(CC_X64) $(CFLAGS) $(SOFLAGS) -o $@ $(SOURCE)

$(LIB_ARM64): $(SOURCE) $(HEADER) | $(LIB_DIR)
	$(CC_ARM64) $(CFLAGS) $(SOFLAGS) -o $@ $(SOURCE)

$(LIB_ARMHF): $(SOURCE) $(HEADER) | $(LIB_DIR)
	$(CC_ARMHF) $(CFLAGS) $(SOFLAGS) -o $@ $(SOURCE)

verify: all
	file $(LIBRARIES)

clean:
	$(RM) $(LIBRARIES)
